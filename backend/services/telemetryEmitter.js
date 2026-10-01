const GateTelemetry = require('../models/GateTelemetry');
const GateDevice = require('../models/GateDevice');
const GateEvent = require('../models/GateEvent');
const mqttHandler = require('../mqtt/mqttHandler');
const { sendUnauthorizedAttemptNotification } = require('./emailService');

const HOME_ID = process.env.HOME_ID || 'home_uk_01';
const GATE_ID = process.env.GATE_ID || 'gate_main_01';

let telemetryCycleCount = 0;

/**
 * Generates and emits real-time sensor data reading at configured intervals (15s default).
 * Updates in-memory state, persists document to MongoDB Replica Set, and broadcasts over MQTT.
 */
async function emitSensorTelemetry(customDate = new Date()) {
  const hour = customDate.getHours();

  // 1. Ambient motor temperature (natural diurnal curve)
  const tempBase = 18.0 + 5.0 * Math.sin(((hour - 8) / 24) * 2 * Math.PI);
  const motorTemperatureC = parseFloat((tempBase + (Math.random() - 0.5) * 1.2).toFixed(1));

  // 2. Diurnal sunlight lux curve (0 at night, up to 800 lux midday)
  let lux = 10;
  if (hour >= 6 && hour <= 19) {
    lux = Math.round(150 + 650 * Math.sin(((hour - 6) / 13) * Math.PI) + (Math.random() - 0.5) * 60);
  } else {
    lux = Math.round(10 + Math.random() * 15);
  }

  // 3. Realistic driveway clearance (240 - 280cm when clear)
  const isVehiclePassing = Math.random() < 0.04;
  const obstacleDistanceCm = isVehiclePassing
    ? Math.round(35 + Math.random() * 40)
    : Math.round(250 + (Math.random() - 0.5) * 20);

  // 4. Optical Photocell Sensor
  const beamContinuity = obstacleDistanceCm >= 45;
  const lensDirtFactor = Math.random();
  let opticalSignalStrength = 96.0;
  let photocellHealth = 'HEALTHY';

  if (!beamContinuity) {
    opticalSignalStrength = parseFloat((12.0 + Math.random() * 15.0).toFixed(1));
    photocellHealth = 'HEALTHY';
  } else if (lensDirtFactor < 0.05) {
    opticalSignalStrength = parseFloat((58.0 + Math.random() * 14.0).toFixed(1));
    photocellHealth = 'DIRTY_LENS_WARNING';
  } else {
    opticalSignalStrength = parseFloat((92.0 + Math.random() * 7.5).toFixed(1));
    opticalSignalStrength = Math.min(100.0, opticalSignalStrength);
    photocellHealth = 'HEALTHY';
  }

  const currentState = mqttHandler.getGateState();
  const status = currentState.status || 'IDLE_CLOSED';
  const lockEngaged = currentState.lockEngaged !== undefined ? currentState.lockEngaged : true;
  const restingState = (status === 'IDLE_CLOSED' || status === 'LOCKED') ? 'FULLY_CLOSED' : (status === 'OPEN' ? 'FULLY_OPEN' : 'AJAR');
  const standbyPowerWatts = (restingState === 'FULLY_CLOSED') ? 2.1 : 48.0;

  // 5. Contactless RFID Reader Sensor
  const noiseSpike = Math.random() < 0.05;
  const backgroundNoiseDbm = noiseSpike
    ? parseFloat((-62.0 + Math.random() * 5.0).toFixed(1))
    : parseFloat((-83.5 + (Math.random() - 0.5) * 3.0).toFixed(1));
  const antennaStatus = noiseSpike ? 'DETUNED' : 'OPTIMAL';

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
    pirMotionDetected: isVehiclePassing || Math.random() < 0.06,
    reedSwitchState: currentState.reedSwitchState || 'CLOSED',
    motorCurrentAmps: currentState.motorCurrentAmps || 0.0,
    motorTemperatureC,
    batteryBackupVoltage,
    ambientLightLux: Math.max(5, lux),
    tamperVibrationG
  };

  // 1. Update in-memory state & notify Web UI listeners
  mqttHandler.setGateState({
    photocell,
    limitSwitch,
    rfidReader,
    obstacleDistanceCm,
    pirMotionDetected: metrics.pirMotionDetected,
    lastUpdated: customDate
  });

  // 2. Persist to MongoDB
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
  } catch (err) {
    return null;
  }

  // 3. Update device heartbeat
  GateDevice.updateOne({ deviceId: 'DEV-CTRL-01' }, { $set: { lastHeartbeat: customDate } }).catch(() => {});

  const timeStr = customDate.toLocaleTimeString();
  const intervalSeconds = (parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000) / 1000;
  console.log(`[Sensor Telemetry ⏱ ${intervalSeconds}s] [${timeStr}] Photocell: ${photocell.opticalSignalStrength}% (${photocell.healthStatus}) | LimitSwitch: ${limitSwitch.restingState} (${limitSwitch.ambientMotorTemperatureC}°C) | RFID: ${rfidReader.backgroundNoiseDbm}dBm`);

  // 4. Autonomous periodic unauthorized sensor event emission
  telemetryCycleCount++;
  const unauthCycles = parseInt(process.env.AUTO_UNAUTHORIZED_INTERVAL_CYCLES || '0', 10);
  if (unauthCycles > 0 && telemetryCycleCount % unauthCycles === 0) {
    const types = ['PERSON', 'RFID', 'ALPR', 'TAMPER'];
    const selected = types[Math.floor(Math.random() * types.length)];
    emitUnauthorizedSensorEvent({ type: selected }).catch(err => {
      console.error('[Telemetry] Periodic unauthorized emission error:', err.message);
    });
  }

  return saved;
}

/**
 * Emits an unauthorized sensor event (unauthorized person, unregistered RFID card, or intruder vehicle).
 * Verifies the gate remains securely locked, persists to MongoDB, broadcasts over MQTT,
 * and automatically dispatches an urgent security alert email to pg016742@gmail.com.
 */
async function emitUnauthorizedSensorEvent({
  type = 'PERSON', // 'PERSON', 'RFID', 'ALPR', 'TAMPER'
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

  // 1. Maintain gate lock integrity
  mqttHandler.setGateState({
    status: 'LOCKED',
    lockEngaged: true,
    pirMotionDetected: true,
    lastUpdated: customDate
  });

  // 2. Persist to MongoDB Replica Set (gate_events)
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

  let savedEvent = null;
  try {
    savedEvent = await eventDoc.save();
  } catch (err) {
    console.error('[Telemetry] Failed to save unauthorized event:', err.message);
  }

  // 3. Broadcast Event over MQTT
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

  // 4. Dispatch Email Alert immediately to pg016742@gmail.com
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
  console.log(`\n🚨 [UNAUTHORIZED SENSOR DATA] [${timeStr}] Type: ${eventType} | ID: ${id} | Gate: LOCKED 🔒`);
  console.log(`  └─ Security Alert Email dispatched to: pg016742@gmail.com (Alert ID: ${emailNotification?.id || 'DISPATCHED'})\n`);

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
