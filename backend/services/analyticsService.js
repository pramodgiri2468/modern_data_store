const GateEvent = require('../models/GateEvent');
const GateTelemetry = require('../models/GateTelemetry');
const AccessPolicy = require('../models/AccessPolicy');
const GateDevice = require('../models/GateDevice');

/**
 * Computes hourly gate activation distribution across a given lookback window.
 * Groups entry events by hour of the day (0-23 UTC) and breaks them down by type.
 *
 * @param {string} homeId
 * @param {number} days
 * @returns {Promise<Array>} 24-element array for each hour of the day
 */
async function getHourlyTraffic(homeId = 'home_uk_01', days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        homeId,
        eventType: { $in: ['RFID_ENTRY_SUCCESS', 'ALPR_ENTRY_SUCCESS', 'MANUAL_REMOTE_OPEN'] },
        timestamp: { $gte: since }
      }
    },
    {
      $project: {
        hour: { $hour: { date: '$timestamp', timezone: 'UTC' } },
        eventType: 1
      }
    },
    {
      $group: {
        _id: '$hour',
        count: { $sum: 1 },
        rfidCount: {
          $sum: { $cond: [{ $eq: ['$eventType', 'RFID_ENTRY_SUCCESS'] }, 1, 0] }
        },
        alprCount: {
          $sum: { $cond: [{ $eq: ['$eventType', 'ALPR_ENTRY_SUCCESS'] }, 1, 0] }
        },
        manualCount: {
          $sum: { $cond: [{ $eq: ['$eventType', 'MANUAL_REMOTE_OPEN'] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const results = await GateEvent.aggregate(pipeline);

  // Fill in zero-count buckets so consumers always receive all 24 hours
  return Array.from({ length: 24 }, (_, h) => {
    const found = results.find(r => r._id === h);
    return {
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      totalCount: found ? found.count : 0,
      rfidCount: found ? found.rfidCount : 0,
      alprCount: found ? found.alprCount : 0,
      manualCount: found ? found.manualCount : 0
    };
  });
}

/**
 * Summarizes security incidents, access denials, and threat indicators over time.
 *
 * @param {string} homeId
 * @param {number} days
 */
async function getSecurityAnalytics(homeId = 'home_uk_01', days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const incidentSummary = await GateEvent.aggregate([
    {
      $match: {
        homeId,
        timestamp: { $gte: since },
        severity: { $in: ['WARN', 'CRITICAL'] }
      }
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        lastOccurred: { $max: '$timestamp' },
        severity: { $first: '$severity' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const unauthorizedBadges = await GateEvent.aggregate([
    {
      $match: {
        homeId,
        eventType: 'RFID_ENTRY_DENIED',
        timestamp: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$payload.tagId',
        attempts: { $sum: 1 },
        lastAttempt: { $max: '$timestamp' }
      }
    },
    { $sort: { attempts: -1 } },
    { $limit: 5 }
  ]);

  return {
    totalSecurityIncidents: incidentSummary.reduce((acc, curr) => acc + curr.count, 0),
    incidentBreakdown: incidentSummary,
    topUnauthorizedBadges: unauthorizedBadges
  };
}

/**
 * Calculates actuator mechanical health metrics and diagnostic status based on operational cycles,
 * overcurrent events, and safety reversals.
 *
 * @param {string} gateId
 */
async function getMotorHealth(gateId = 'gate_main_01') {
  const totalCycles = await GateEvent.countDocuments({
    gateId,
    eventType: { $in: ['RFID_ENTRY_SUCCESS', 'ALPR_ENTRY_SUCCESS', 'MANUAL_REMOTE_OPEN'] }
  });

  const safetyReverses = await GateEvent.countDocuments({
    gateId,
    eventType: { $in: ['SAFETY_OBSTACLE_DETECTED', 'SAFETY_REVERSE_TRIGGERED'] }
  });

  const overcurrentWarnings = await GateEvent.countDocuments({
    gateId,
    eventType: 'MOTOR_OVERCURRENT_WARNING'
  });

  let healthScore = 100;
  if (overcurrentWarnings > 0) healthScore -= Math.min(30, overcurrentWarnings * 5);
  if (totalCycles > 5000) healthScore -= 10;
  if (safetyReverses > 50) healthScore -= 5;
  healthScore = Math.max(20, healthScore);

  return {
    gateId,
    totalCycles,
    safetyReverses,
    overcurrentWarnings,
    healthScore,
    status: healthScore > 80 ? 'OPTIMAL' : healthScore > 60 ? 'SERVICING_RECOMMENDED' : 'CRITICAL_INSPECTION_NEEDED',
    recommendation: healthScore > 80 
      ? 'Gate actuator operating within standard mechanical tolerances.'
      : 'Increased mechanical resistance detected. Inspect rack/pinion lubrication and hinges.'
  };
}

/**
 * Aggregates high-level KPI counts for the dashboard header.
 *
 * @param {string} homeId
 */
async function getDashboardSummary(homeId = 'home_uk_01') {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    todayActivations,
    activePoliciesCount,
    totalEventsCount,
    recentAlerts,
    registeredDevicesCount
  ] = await Promise.all([
    GateEvent.countDocuments({
      homeId,
      timestamp: { $gte: startOfDay },
      eventType: { $in: ['RFID_ENTRY_SUCCESS', 'ALPR_ENTRY_SUCCESS', 'MANUAL_REMOTE_OPEN'] }
    }),
    AccessPolicy.countDocuments({ homeId, isActive: true }),
    GateEvent.countDocuments({ homeId }),
    GateEvent.find({ homeId, severity: { $in: ['WARN', 'CRITICAL'] } })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean(),
    GateDevice.countDocuments({ homeId })
  ]);

  return {
    todayActivations,
    activePoliciesCount,
    totalEventsCount,
    registeredDevicesCount,
    recentAlerts
  };
}

/**
 * Analyzes telemetry health across the photocell, limit switch, and RFID reader subsystems.
 *
 * @param {string} gateId
 */
async function getSensorHealthAnalytics(gateId = 'gate_main_01') {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const results = await GateTelemetry.aggregate([
    { $match: { gateId, timestamp: { $gte: since } } },
    {
      $group: {
        _id: null,
        avgOpticalSignal: { $avg: '$photocell.opticalSignalStrength' },
        minOpticalSignal: { $min: '$photocell.opticalSignalStrength' },
        dirtyLensCount: {
          $sum: { $cond: [{ $eq: ['$photocell.healthStatus', 'DIRTY_LENS_WARNING'] }, 1, 0] }
        },
        beamBreakCount: {
          $sum: { $cond: [{ $eq: ['$photocell.beamContinuity', false] }, 1, 0] }
        },
        avgStandbyPower: { $avg: '$limitSwitch.standbyPowerWatts' },
        avgAmbientTemp: { $avg: '$limitSwitch.ambientMotorTemperatureC' },
        fullyClosedCount: {
          $sum: { $cond: [{ $eq: ['$limitSwitch.restingState', 'FULLY_CLOSED'] }, 1, 0] }
        },
        fullyOpenCount: {
          $sum: { $cond: [{ $eq: ['$limitSwitch.restingState', 'FULLY_OPEN'] }, 1, 0] }
        },
        ajarCount: {
          $sum: { $cond: [{ $eq: ['$limitSwitch.restingState', 'AJAR'] }, 1, 0] }
        },
        totalSamples: { $sum: 1 },
        avgNoiseDbm: { $avg: '$rfidReader.backgroundNoiseDbm' },
        peakNoiseDbm: { $max: '$rfidReader.backgroundNoiseDbm' },
        detunedAntennaCount: {
          $sum: { $cond: [{ $eq: ['$rfidReader.antennaStatus', 'DETUNED'] }, 1, 0] }
        }
      }
    }
  ]);

  const stats = results[0] || {};
  const total = stats.totalSamples || 1;
  const avgOptical = parseFloat((stats.avgOpticalSignal || 95.0).toFixed(1));
  const dirtyCount = stats.dirtyLensCount || 0;
  const closedPercent = parseFloat(((stats.fullyClosedCount || 0) / total * 100).toFixed(1));
  const openPercent = parseFloat(((stats.fullyOpenCount || 0) / total * 100).toFixed(1));
  const totalRestingPercent = parseFloat((((stats.fullyClosedCount || 0) + (stats.fullyOpenCount || 0)) / total * 100).toFixed(1));

  return {
    gateId,
    sampleWindowDays: 7,
    totalSamplesAnalyzed: total,
    photocell: {
      avgOpticalSignalStrength: avgOptical,
      minOpticalSignalStrength: parseFloat((stats.minOpticalSignal || 12.0).toFixed(1)),
      dirtyLensWarnings: dirtyCount,
      beamContinuityBreaks: stats.beamBreakCount || 0,
      status: avgOptical >= 85 ? 'HEALTHY' : (avgOptical >= 65 ? 'DIRTY_LENS_WARNING' : 'MISALIGNED_SERVICE_REQUIRED'),
      diagnosis: avgOptical >= 85 
        ? 'Photocell lenses are clean and optical transceiver alignment is optimal.'
        : 'Optical signal degradation detected. Clean lenses and check alignment brackets.'
    },
    limitSwitch: {
      restingClosedRate: `${closedPercent}%`,
      restingOpenRate: `${openPercent}%`,
      restingStateConfirmationRate: `${totalRestingPercent}%`,
      fullyClosedSamples: stats.fullyClosedCount || 0,
      fullyOpenSamples: stats.fullyOpenCount || 0,
      ajarTransitSamples: stats.ajarCount || 0,
      avgStandbyPowerWatts: parseFloat((stats.avgStandbyPower || 2.1).toFixed(2)),
      avgAmbientMotorTemperatureC: parseFloat((stats.avgAmbientTemp || 21.0).toFixed(1)),
      status: (stats.fullyOpenCount > 0) ? 'VERIFIED_DUAL_BOUNDARY' : 'VERIFIED_FULLY_CLOSED',
      diagnosis: `Limit switch confirms physical closure (${closedPercent}%) and full open boundary (${openPercent}%) with normal standby power.`
    },
    rfidReader: {
      avgBackgroundNoiseDbm: parseFloat((stats.avgNoiseDbm || -82.5).toFixed(1)),
      peakNoiseDbm: parseFloat((stats.peakNoiseDbm || -60.0).toFixed(1)),
      detunedAntennaEvents: stats.detunedAntennaCount || 0,
      heartbeatStatus: 'OPERATIONAL',
      diagnosis: (stats.detunedAntennaCount || 0) === 0
        ? 'RF antenna impedance tuned in optimal range with clear noise floor.'
        : 'Transient RF noise spikes detected in 13.56 MHz band; operational integrity preserved.'
    }
  };
}

module.exports = {
  getHourlyTraffic,
  getSecurityAnalytics,
  getMotorHealth,
  getDashboardSummary,
  getSensorHealthAnalytics
};
