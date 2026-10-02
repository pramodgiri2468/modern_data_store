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
  let obstacleDistanceCm = isVehiclePassing
    ? Math.round(35 + Math.random() * 40)
    : Math.round(250 + (Math.random() - 0.5) * 20);

  // 4. Optical Photocell Sensor baseline
  let beamContinuity = obstacleDistanceCm >= 45;
  let opticalSignalStrength = 96.0;
  let photocellHealth = 'HEALTHY';

  // 5. Contactless RFID Reader baseline
  let backgroundNoiseDbm = parseFloat((-83.5 + (Math.random() - 0.5) * 3.0).toFixed(1));
  let antennaStatus = 'OPTIMAL';

  const currentState = mqttHandler.getGateState();
  telemetryCycleCount++;

  // Mixed operational profiles across 15-second intervals:
  // Dynamically produces a rich, realistic mix of sensor data:
  // FULLY_CLOSED, FULLY_OPEN, and AJAR states, along with varied photocell beam conditions and RFID noise.
  let status = currentState.status || 'IDLE_CLOSED';
  let lockEngaged = currentState.lockEngaged !== undefined ? currentState.lockEngaged : true;
  let reedSwitchState = currentState.reedSwitchState || 'CLOSED';
  let motorCurrentAmps = 0.0;
  let restingState = 'FULLY_CLOSED';
  let standbyPowerWatts = 2.1;
  let pirMotionDetected = isVehiclePassing || Math.random() < 0.06;

  // Cycle through mixed states every 15 seconds unless manual hold is active
  const cycleMode = telemetryCycleCount % 6;
  if (cycleMode === 0) {
    // 1. Resting Locked (FULLY_CLOSED)
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
    // 2. Gate Opening Transit (AJAR)
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
    // 3. Resting Fully Open (FULLY_OPEN - Resident / Delivery Hold)
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
    // 4. Fully Open with Vehicle Traversal (FULLY_OPEN, Optical Beam Interrupted)
    status = 'OPEN';
    lockEngaged = false;
    reedSwitchState = 'OPEN';
    restingState = 'FULLY_OPEN';
    standbyPowerWatts = 2.3;
    motorCurrentAmps = 0.0;
    obstacleDistanceCm = 34; // Vehicle traversing photocell beam
    pirMotionDetected = true;
    beamContinuity = false;
    opticalSignalStrength = 18.0;
    photocellHealth = 'HEALTHY';
    antennaStatus = 'OPTIMAL';
    backgroundNoiseDbm = -81.0;
  } else if (cycleMode === 4) {
    // 5. Gate Closing Transit (AJAR)
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
    // 6. Resting Closed with Sensor Variation (FULLY_CLOSED, Dirty Lens Warning, RFID Noise)
    status = 'IDLE_CLOSED';
    lockEngaged = true;
    reedSwitchState = 'CLOSED';
    restingState = 'FULLY_CLOSED';
    standbyPowerWatts = 2.1;
    motorCurrentAmps = 0.0;
    obstacleDistanceCm = 265;
    pirMotionDetected = false;
    beamContinuity = true;
    opticalSignalStrength = 64.0; // Dust accumulation on photocell lens
    photocellHealth = 'DIRTY_LENS_WARNING';
    antennaStatus = 'DETUNED'; // Transient RF noise spike
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

  // 1. Update in-memory state & notify Web UI listeners
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

  // Broadcast to MQTT
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

  // 3. Update device heartbeat
  GateDevice.updateOne({ deviceId: 'DEV-CTRL-01' }, { $set: { lastHeartbeat: customDate } }).catch(() => {});

  const timeStr = customDate.toLocaleTimeString();
  const intervalSeconds = (parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000) / 1000;
  console.log(`[Sensor Telemetry ⏱ ${intervalSeconds}s] [${timeStr}] Status: ${status} | LimitSwitch: ${limitSwitch.restingState} (${limitSwitch.standbyPowerWatts}W) | Photocell: ${photocell.opticalSignalStrength}% (${photocell.healthStatus}, Beam: ${beamContinuity ? 'CLEAR' : 'OBSTRUCTED'}) | RFID: ${rfidReader.backgroundNoiseDbm}dBm (${rfidReader.antennaStatus})`);

  // 4a. Autonomous periodic authorized gate cycle (every 6 cycles = ~90s)
  // Exercises FULLY_OPEN limit switch resting state and realistic resident movements
  const autoGateCycles = process.env.AUTO_GATE_CYCLES !== 'false';
  if (autoGateCycles && telemetryCycleCount % 6 === 0 && currentState.status !== 'OPEN') {
    const cycleType = (telemetryCycleCount % 12 === 0) ? 'RESIDENT_RFID' : 'RESIDENT_ALPR';
    console.log(`[Auto Simulator Cycle] Triggering authorized resident entrance (${cycleType}). Opening gate to FULLY_OPEN...`);
    mqttHandler.publishCommand(HOME_ID, GATE_ID, 'OPEN', `Autonomous Cycle: Authorized Resident (${cycleType})`);
  }

  // 4b. Autonomous periodic unauthorized sensor event emission (every 8 cycles if configured)
  const unauthCycles = parseInt(process.env.AUTO_UNAUTHORIZED_INTERVAL_CYCLES || '0', 10);
  if (unauthCycles > 0 && telemetryCycleCount % (unauthCycles * 2) === unauthCycles) {
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
