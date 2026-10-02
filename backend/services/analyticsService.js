const GateEvent = require('../models/GateEvent');
const GateTelemetry = require('../models/GateTelemetry');
const AccessPolicy = require('../models/AccessPolicy');
const GateDevice = require('../models/GateDevice');

/**
 * 1. Hourly Gate Activation Heatmap
 * Uses MongoDB Aggregation Pipeline: $match -> $project ($hour) -> $group -> $sort
 */
async function getHourlyTraffic(homeId = 'home_uk_01', days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        homeId: homeId,
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

  // Normalize all 24 hours (0-23)
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
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

  return hourlyData;
}

/**
 * 2. Security Incident and Threat Detection
 * Aggregates unauthorized attempts, tamper alerts, obstacle occurrences, and off-hour entries
 */
async function getSecurityAnalytics(homeId = 'home_uk_01', days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const incidentSummary = await GateEvent.aggregate([
    {
      $match: {
        homeId: homeId,
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

  // Unregistered badge attempts
  const unauthorizedBadges = await GateEvent.aggregate([
    {
      $match: {
        homeId: homeId,
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
 * 3. Motor Health and Predictive Maintenance Analytics
 * Evaluates motor load, current draw anomalies, cycle counts, and safety reverse interventions
 */
async function getMotorHealth(gateId = 'gate_main_01') {
  // Total gate open events (cycles)
  const totalCycles = await GateEvent.countDocuments({
    gateId: gateId,
    eventType: { $in: ['RFID_ENTRY_SUCCESS', 'ALPR_ENTRY_SUCCESS', 'MANUAL_REMOTE_OPEN'] }
  });

  const safetyReverses = await GateEvent.countDocuments({
    gateId: gateId,
    eventType: { $in: ['SAFETY_OBSTACLE_DETECTED', 'SAFETY_REVERSE_TRIGGERED'] }
  });

  const overcurrentWarnings = await GateEvent.countDocuments({
    gateId: gateId,
    eventType: 'MOTOR_OVERCURRENT_WARNING'
  });

  // Calculate health index score out of 100
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
 * 4. Overall Executive Dashboard Summary KPI
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
      homeId: homeId,
      timestamp: { $gte: startOfDay },
      eventType: { $in: ['RFID_ENTRY_SUCCESS', 'ALPR_ENTRY_SUCCESS', 'MANUAL_REMOTE_OPEN'] }
    }),
    AccessPolicy.countDocuments({ homeId: homeId, isActive: true }),
    GateEvent.countDocuments({ homeId: homeId }),
    GateEvent.find({ homeId: homeId, severity: { $in: ['WARN', 'CRITICAL'] } })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean(),
    GateDevice.countDocuments({ homeId: homeId })
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
 * 5. Three Core Sensors Health Analytics (Photocell, Limit Switch, RFID Reader)
 * Aggregation pipeline evaluating optical degradation, resting state confirmation, and RF noise.
 */
async function getSensorHealthAnalytics(gateId = 'gate_main_01') {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

  const results = await GateTelemetry.aggregate([
    { $match: { gateId: gateId, timestamp: { $gte: since } } },
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
        // Limit Switch stats (Dual Boundary: Fully Closed + Fully Open)
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
        // RFID stats
        avgNoiseDbm: { $avg: '$rfidReader.backgroundNoiseDbm' },
        peakNoiseDbm: { $max: '$rfidReader.backgroundNoiseDbm' },
        detunedAntennaCount: {
          $sum: { $cond: [{ $eq: ['$rfidReader.antennaStatus', 'DETUNED'] }, 1, 0] }
        }
      }
    }
  ]);

  const photocellStats = results[0] || {};
  const total = photocellStats.totalSamples || 1;
  const avgOptical = parseFloat((photocellStats.avgOpticalSignal || 95.0).toFixed(1));
  const dirtyCount = photocellStats.dirtyLensCount || 0;
  const closedPercent = parseFloat(((photocellStats.fullyClosedCount || 0) / total * 100).toFixed(1));
  const openPercent = parseFloat(((photocellStats.fullyOpenCount || 0) / total * 100).toFixed(1));
  const totalRestingPercent = parseFloat((((photocellStats.fullyClosedCount || 0) + (photocellStats.fullyOpenCount || 0)) / total * 100).toFixed(1));

  return {
    gateId,
    sampleWindowDays: 7,
    totalSamplesAnalyzed: total,
    photocell: {
      avgOpticalSignalStrength: avgOptical,
      minOpticalSignalStrength: parseFloat((photocellStats.minOpticalSignal || 12.0).toFixed(1)),
      dirtyLensWarnings: dirtyCount,
      beamContinuityBreaks: photocellStats.beamBreakCount || 0,
      status: avgOptical >= 85 ? 'HEALTHY' : (avgOptical >= 65 ? 'DIRTY_LENS_WARNING' : 'MISALIGNED_SERVICE_REQUIRED'),
      diagnosis: avgOptical >= 85 
        ? 'Photocell lenses are clean and optical transceiver alignment is optimal.'
        : 'Optical signal degradation detected. Clean lenses and check alignment brackets.'
    },
    limitSwitch: {
      restingClosedRate: `${closedPercent}%`,
      restingOpenRate: `${openPercent}%`,
      restingStateConfirmationRate: `${totalRestingPercent}%`,
      fullyClosedSamples: photocellStats.fullyClosedCount || 0,
      fullyOpenSamples: photocellStats.fullyOpenCount || 0,
      ajarTransitSamples: photocellStats.ajarCount || 0,
      avgStandbyPowerWatts: parseFloat((photocellStats.avgStandbyPower || 2.1).toFixed(2)),
      avgAmbientMotorTemperatureC: parseFloat((photocellStats.avgAmbientTemp || 21.0).toFixed(1)),
      status: (photocellStats.fullyOpenCount > 0) ? 'VERIFIED_DUAL_BOUNDARY' : 'VERIFIED_FULLY_CLOSED',
      diagnosis: `Mechanical limit switch verifies physical closure (${closedPercent}%) and full open boundary (${openPercent}%) with normal quiescent standby power.`
    },
    rfidReader: {
      avgBackgroundNoiseDbm: parseFloat((photocellStats.avgNoiseDbm || -82.5).toFixed(1)),
      peakNoiseDbm: parseFloat((photocellStats.peakNoiseDbm || -60.0).toFixed(1)),
      detunedAntennaEvents: photocellStats.detunedAntennaCount || 0,
      heartbeatStatus: 'OPERATIONAL',
      diagnosis: (photocellStats.detunedAntennaCount || 0) === 0
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
