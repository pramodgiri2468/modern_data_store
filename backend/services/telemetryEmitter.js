const GateTelemetry = require('../models/GateTelemetry');
const GateDevice = require('../models/GateDevice');
const GateEvent = require('../models/GateEvent');
const mqttHandler = require('../mqtt/mqttHandler');
const { sendUnauthorizedAttemptNotification } = require('./emailService');

const HOME_ID = process.env.HOME_ID || 'home_uk_01';
const GATE_ID = process.env.GATE_ID || 'gate_main_01';

let telemetryCycleCount = 0;

/**
 * Generates and records periodic sensor telemetry reading.
 * Updates in-memory state, persists document to MongoDB, and publishes to MQTT.
 */
async function emitSensorTelemetry(customDate = new Date()) {
  const hour = customDate.getHours();

  // Model daily ambient temperature fluctuation
  const tempBase = 18.0 + 5.0 * Math.sin(((hour - 8) / 24) * 2 * Math.PI);
  const motorTemperatureC = parseFloat((tempBase + (Math.random() - 0.5) * 1.2).toFixed(1));

  // Ambient lux based on time of day
  let lux = 10;
  if (hour >= 6 && hour <= 19) {
    lux = Math.round(150 + 650 * Math.sin(((hour - 6) / 13) * Math.PI) + (Math.random() - 0.5) * 60);
  } else {
    lux = Math.round(10 + Math.random() * 15);
  }

  // Driveway clearance distance
  const isVehiclePassing = Math.random() < 0.04;
  let obstacleDistanceCm = isVehiclePassing
    ? Math.round(35 + Math.random() * 40)
    : Math.round(250 + (Math.random() - 0.5) * 20);

  let beamContinuity = obstacleDistanceCm >= 45;
  let opticalSignalStrength = 96.0;
  let photocellHealth = 'HEALTHY';

  let backgroundNoiseDbm = parseFloat((-83.5 + (Math.random() - 0.5) * 3.0).toFixed(1));
  let antennaStatus = 'OPTIMAL';

  const currentState = mqttHandler.getGateState();
  telemetryCycleCount++;

  let status = currentState.status || 'IDLE_CLOSED';
  let lockEngaged = currentState.lockEngaged !== undefined ? currentState.lockEngaged : true;
  let reedSwitchState = currentState.reedSwitchState || 'CLOSED';
  let motorCurrentAmps = 0.0;
  let restingState = 'FULLY_CLOSED';
  let standbyPowerWatts = 2.1;
  let pirMotionDetected = isVehiclePassing || Math.random() < 0.06;

  // Simulate cyclic gate usage patterns
  const cycleMode = telemetryCycleCount % 6;
  if (cycleMode === 0) {
    status = 'LOCKED';
    lockEngaged = true;
    reedSwitchState = 'CLOSED';
    restingState = 'FULLY_CLOSED';
    standbyPowerWatts = 2.1;
    motorCurrentAmps = 0.0;
    obstacleDistanceCm = 260 + Math.round((Math.random() - 0.5) * 10);
    pirMotionDetected = false;
    beamContinuity = true;
    opticalSignalStrength = 96.5;
    photocellHealth = 'HEALTHY';
    antennaStatus = 'OPTIMAL';
    backgroundNoiseDbm = -83.5;
  } else if (cycleMode === 1) {
    status = 'OPENING';
    lockEngaged = false;
    reedSwitchState = 'AJAR';
    restingState = 'AJAR';
    standbyPowerWatts = 48.0;
    motorCurrentAmps = parseFloat((3.7 + Math.random() * 0.4).toFixed(2));
    obstacleDistanceCm = 240;
    pirMotionDetected = true;
    beamContinuity = true;
    opticalSignalStrength = 94.0;
    photocellHealth = 'HEALTHY';
    antennaStatus = 'OPTIMAL';
    backgroundNoiseDbm = -82.0;
  } else if (cycleMode === 2) {
    status = 'OPEN';
    lockEngaged = false;
    reedSwitchState = 'OPEN';
    restingState = 'FULLY_OPEN';
    standbyPowerWatts = 2.3;
    motorCurrentAmps = 0.0;
    obstacleDistanceCm = 280;
    pirMotionDetected = true;
    beamContinuity = true;
    opticalSignalStrength = 96.0;
    photocellHealth = 'HEALTHY';
    antennaStatus = 'OPTIMAL';
    backgroundNoiseDbm = -84.0;
  } else if (cycleMode === 3) {
    status = 'OPEN';
    lockEngaged = false;
    reedSwitchState = 'OPEN';
    restingState = 'FULLY_OPEN';
    standbyPowerWatts = 2.3;
    motorCurrentAmps = 0.0;
    obstacleDistanceCm = 34;
    pirMotionDetected = true;
    beamContinuity = false;
    opticalSignalStrength = 18.0;
    photocellHealth = 'HEALTHY';
    antennaStatus = 'OPTIMAL';
    backgroundNoiseDbm = -81.0;
  } else if (cycleMode === 4) {
    status = 'CLOSING';
    lockEngaged = false;
    reedSwitchState = 'AJAR';
    restingState = 'AJAR';
    standbyPowerWatts = 48.0;
    motorCurrentAmps = parseFloat((4.0 + Math.random() * 0.3).toFixed(2));
    obstacleDistanceCm = 255;
    pirMotionDetected = false;
    beamContinuity = true;
    opticalSignalStrength = 95.0;
    photocellHealth = 'HEALTHY';
    antennaStatus = 'OPTIMAL';
    backgroundNoiseDbm = -83.0;
  } else if (cycleMode === 5) {
    status = 'IDLE_CLOSED';
    lockEngaged = true;
    reedSwitchState = 'CLOSED';
    restingState = 'FULLY_CLOSED';
    standbyPowerWatts = 2.1;
    motorCurrentAmps = 0.0;
    obstacleDistanceCm = 265;
    pirMotionDetected = false;
    beamContinuity = true;
    opticalSignalStrength = 64.0;
    photocellHealth = 'DIRTY_LENS_WARNING';
    antennaStatus = 'DETUNED';
    backgroundNoiseDbm = -62.0;
  }

  const batteryBackupVoltage = parseFloat((12.75 + (Math.random() - 0.5) * 0.15).toFixed(2));
  const tamperVibrationG = parseFloat((0.02 + Math.random() * 0.01).toFixed(3));

  const photocell = {
    healthStatus: photocellHealth,
    opticalSignalStrength,
    beamContinuity
  };

  const limitSwitch = {
    restingState,
    ambientMotorTemperatureC: motorTemperatureC,
    standbyPowerWatts
  };

  const rfidReader = {
    operationalHeartbeat: true,
    antennaStatus,
    backgroundNoiseDbm
  };

  const metrics = {
    obstacleDistanceCm,
    pirMotionDetected,
    reedSwitchState,
    motorCurrentAmps,
    motorTemperatureC,
    batteryBackupVoltage,
    ambientLightLux: Math.max(5, lux),
    tamperVibrationG
  };

  mqttHandler.setGateState({
    status,
    lockEngaged,
    photocell,
    limitSwitch,
    rfidReader,
    obstacleDistanceCm,
    pirMotionDetected,
    reedSwitchState,
    motorCurrentAmps,
    lastUpdated: customDate
  });

  const doc = new GateTelemetry({
    homeId: HOME_ID,
    gateId: GATE_ID,
    status,
    lockEngaged,
    photocell,
    limitSwitch,
    rfidReader,
    metrics,
    timestamp: customDate
  });

  let saved = null;
  try {
    saved = await doc.save();
  } catch {
    return null;
  }

  mqttHandler.publishTelemetry(HOME_ID, {
    gateId: GATE_ID,
    homeId: HOME_ID,
    status,
    lockEngaged,
    photocell,
    limitSwitch,
    rfidReader,
    metrics,
    timestamp: customDate.toISOString()
  });

  GateDevice.updateOne({ deviceId: 'DEV-CTRL-01' }, { $set: { lastHeartbeat: customDate } }).catch(() => {});

  const timeStr = customDate.toLocaleTimeString();
  console.log(`[telemetry] ${timeStr} | ${status} | Limit: ${limitSwitch.restingState} (${limitSwitch.standbyPowerWatts}W) | Photocell: ${photocell.opticalSignalStrength}% | RFID: ${rfidReader.backgroundNoiseDbm}dBm`);

  // Periodic simulated cycle
  const autoGateCycles = process.env.AUTO_GATE_CYCLES !== 'false';
  if (autoGateCycles && telemetryCycleCount % 6 === 0 && currentState.status !== 'OPEN') {
    const cycleType = (telemetryCycleCount % 12 === 0) ? 'RESIDENT_RFID' : 'RESIDENT_ALPR';
    console.log(`[telemetry] Cycling gate for simulated resident entry (${cycleType})`);
    mqttHandler.publishCommand(HOME_ID, GATE_ID, 'OPEN', `Autonomous Cycle: Authorized Resident (${cycleType})`);
  }

  const unauthCycles = parseInt(process.env.AUTO_UNAUTHORIZED_INTERVAL_CYCLES || '0', 10);
  if (unauthCycles > 0 && telemetryCycleCount % (unauthCycles * 2) === unauthCycles) {
    const types = ['PERSON', 'RFID', 'ALPR', 'TAMPER'];
    const selected = types[Math.floor(Math.random() * types.length)];
    emitUnauthorizedSensorEvent({ type: selected }).catch(err => {
      console.error('[telemetry] Background alert simulation error:', err.message);
    });
  }

  return saved;
}

/**
 * Handles unauthorized access attempts and perimeter events.
 * Keeps gate locked, stores audit record, and triggers alert email.
 */
async function emitUnauthorizedSensorEvent({
  type = 'PERSON',
  identifier = null,
  personName = 'Unauthorized Person / Intruder',
  reason = null,
  customDate = new Date()
} = {}) {
  let eventType = 'INTRUSION_DETECTED';
  let severity = 'CRITICAL';
  let sensorId = 'sensor_pir_driveway';
  let credentialType = 'PHYSICAL_INTRUSION';
  let id = identifier || `UNAUTHORIZED-PERSON-${Math.floor(1000 + Math.random() * 9000)}`;
  let method = 'PIR_PERIMETER_DETECTION';
  let failureReason = reason || 'Unauthorized person entered property perimeter while gate is locked';

  if (type === 'RFID') {
    eventType = 'RFID_ENTRY_DENIED';
    severity = 'WARN';
    sensorId = 'sensor_rfid_pillar';
    credentialType = 'RFID_TAG';
    id = identifier || `UNKNOWN-CLONE-${Math.floor(10 + Math.random() * 90)}`;
    method = 'RFID_CONTACTLESS_SCAN';
    failureReason = reason || 'Unregistered or cloned RFID card presented at gate pillar';
  } else if (type === 'ALPR') {
    eventType = 'ALPR_ENTRY_DENIED';
    severity = 'WARN';
    sensorId = 'sensor_alpr_cam01';
    credentialType = 'LICENSE_PLATE';
    id = identifier || `UNKNOWN-INTRUDER-${Math.floor(10 + Math.random() * 90)}`;
    method = 'ALPR_VEHICLE_SCAN';
    failureReason = reason || 'Unregistered vehicle license plate detected at driveway entrance';
  } else if (type === 'TAMPER') {
    eventType = 'TAMPER_ALARM';
    severity = 'CRITICAL';
    sensorId = 'sensor_tamper_accel';
    credentialType = 'PHYSICAL_BREACH';
    id = identifier || 'ENCLOSURE_SHOCK_3.8G';
    method = 'HOUSING_ACCELEROMETER';
    failureReason = reason || 'High physical vibration shock detected on gate controller enclosure';
  }

  mqttHandler.setGateState({
    status: 'LOCKED',
    lockEngaged: true,
    pirMotionDetected: true,
    lastUpdated: customDate
  });

  const eventId = `EVT-UNAUTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const eventDoc = new GateEvent({
    eventId,
    homeId: HOME_ID,
    gateId: GATE_ID,
    eventType,
    severity,
    sensorId,
    source: 'SENSOR_TELEMETRY_PIPELINE',
    payload: {
      identifier: id,
      credentialType,
      method,
      failureReason,
      lockEngaged: true,
      gateStatus: 'LOCKED',
      personName
    },
    timestamp: customDate
  });

  try {
    await eventDoc.save();
  } catch (err) {
    console.error('[telemetry] Failed to record unauthorized event:', err.message);
  }

  mqttHandler.publishEvent(HOME_ID, {
    eventId,
    gateId: GATE_ID,
    eventType,
    severity,
    sensorId,
    source: 'SENSOR_TELEMETRY_PIPELINE',
    payload: eventDoc.payload,
    timestamp: customDate.toISOString()
  });

  const emailNotification = await sendUnauthorizedAttemptNotification({
    homeId: HOME_ID,
    gateId: GATE_ID,
    credentialType,
    identifier: id,
    method,
    reason: failureReason,
    timestamp: customDate
  });

  const timeStr = customDate.toLocaleTimeString();
  console.log(`[security] ${timeStr} | Intrusion alert: ${eventType} (${id}) - Gate remains locked`);

  return {
    success: true,
    eventId,
    eventType,
    severity,
    identifier: id,
    personName,
    reason: failureReason,
    gateStatus: 'LOCKED',
    lockEngaged: true,
    emailNotification
  };
}

module.exports = {
  emitSensorTelemetry,
  emitUnauthorizedSensorEvent
};
