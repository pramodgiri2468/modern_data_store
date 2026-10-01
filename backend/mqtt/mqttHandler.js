const mqtt = require('mqtt');
const GateEvent = require('../models/GateEvent');
const GateTelemetry = require('../models/GateTelemetry');
const AccessPolicy = require('../models/AccessPolicy');
const { sendAuthorizedEntryNotification, sendUnauthorizedAttemptNotification } = require('../services/emailService');
const { v4: uuidv4 } = require('crypto');

let client = null;
let currentGateState = {
  gateId: 'gate_main_01',
  homeId: 'home_uk_01',
  status: 'IDLE_CLOSED',
  lockEngaged: true,
  reedSwitchState: 'CLOSED',
  obstacleDistanceCm: 250,
  pirMotionDetected: false,
  motorCurrentAmps: 0.0,
  
  // 3 Core Sensors requested by user
  photocell: {
    healthStatus: 'HEALTHY',
    opticalSignalStrength: 96.0,
    beamContinuity: true
  },
  limitSwitch: {
    restingState: 'FULLY_CLOSED',
    ambientMotorTemperatureC: 21.5,
    standbyPowerWatts: 2.1
  },
  rfidReader: {
    operationalHeartbeat: true,
    antennaStatus: 'OPTIMAL',
    backgroundNoiseDbm: -82.0
  },

  lastUpdated: new Date()
};

const listeners = new Set();

function registerStateListener(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyListeners() {
  for (const cb of listeners) {
    try { cb(currentGateState); } catch (e) { console.error('Listener err:', e); }
  }
}

function initMqttClient(brokerUrl = 'mqtt://127.0.0.1:1883') {
  client = mqtt.connect(brokerUrl, {
    clientId: `iothings_backend_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 2000
  });

  client.on('connect', () => {
    console.log('[MQTT Client] Connected to MQTT broker. Subscribing to iothings/home/+/gate/#');
    client.subscribe('iothings/home/+/gate/#', { qos: 1 }, (err) => {
      if (err) console.error('[MQTT Client] Subscription error:', err);
    });
  });

  client.on('message', async (topic, payloadBuffer) => {
    try {
      const payloadStr = payloadBuffer.toString();
      const data = JSON.parse(payloadStr);

      const parts = topic.split('/');
      const homeId = parts[2] || 'home_uk_01';
      const category = parts[4]; // telemetry, events, status, commands

      if (category === 'telemetry') {
        await handleTelemetryMessage(homeId, data);
      } else if (category === 'events') {
        await handleEventMessage(homeId, data);
      } else if (category === 'status') {
        handleStatusMessage(homeId, data);
      }
    } catch (err) {
      console.error('[MQTT Client] Error processing message on topic', topic, err.message);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT Client] Error:', err.message);
  });

  return client;
}

async function handleTelemetryMessage(homeId, data) {
  const photocell = data.photocell || {
    healthStatus: (data.metrics?.obstacleDistanceCm < 45 ? 'DIRTY_LENS_WARNING' : 'HEALTHY'),
    opticalSignalStrength: data.photocell?.opticalSignalStrength ?? (data.metrics?.obstacleDistanceCm < 45 ? 52.0 : 96.0),
    beamContinuity: data.photocell?.beamContinuity !== undefined ? data.photocell.beamContinuity : (data.metrics?.obstacleDistanceCm >= 45)
  };

  const limitSwitch = data.limitSwitch || {
    restingState: (data.status === 'IDLE_CLOSED' || data.status === 'LOCKED') ? 'FULLY_CLOSED' : (data.status === 'OPEN' ? 'FULLY_OPEN' : 'AJAR'),
    ambientMotorTemperatureC: data.metrics?.motorTemperatureC || 21.5,
    standbyPowerWatts: (data.status === 'IDLE_CLOSED' || data.status === 'LOCKED') ? 2.1 : 48.0
  };

  const rfidReader = data.rfidReader || {
    operationalHeartbeat: true,
    antennaStatus: 'OPTIMAL',
    backgroundNoiseDbm: data.rfidReader?.backgroundNoiseDbm ?? -82.0
  };

  // Update in-memory state
  currentGateState = {
    ...currentGateState,
    homeId,
    gateId: data.gateId || 'gate_main_01',
    status: data.status || currentGateState.status,
    lockEngaged: data.lockEngaged !== undefined ? data.lockEngaged : currentGateState.lockEngaged,
    obstacleDistanceCm: data.metrics?.obstacleDistanceCm || 250,
    pirMotionDetected: !!data.metrics?.pirMotionDetected,
    reedSwitchState: data.metrics?.reedSwitchState || 'CLOSED',
    motorCurrentAmps: data.metrics?.motorCurrentAmps || 0.0,
    photocell,
    limitSwitch,
    rfidReader,
    lastUpdated: new Date()
  };

  notifyListeners();

  // Persist to MongoDB
  try {
    const doc = new GateTelemetry({
      homeId: homeId,
      gateId: data.gateId || 'gate_main_01',
      status: currentGateState.status,
      photocell,
      limitSwitch,
      rfidReader,
      metrics: {
        obstacleDistanceCm: data.metrics?.obstacleDistanceCm ?? 250,
        pirMotionDetected: !!data.metrics?.pirMotionDetected,
        reedSwitchState: data.metrics?.reedSwitchState || 'CLOSED',
        motorCurrentAmps: data.metrics?.motorCurrentAmps || 0.0,
        motorTemperatureC: limitSwitch.ambientMotorTemperatureC,
        batteryBackupVoltage: data.metrics?.batteryBackupVoltage || 12.8,
        ambientLightLux: data.metrics?.ambientLightLux || 450,
        tamperVibrationG: data.metrics?.tamperVibrationG || 0.02
      },
      lockEngaged: currentGateState.lockEngaged,
      timestamp: new Date()
    });
    await doc.save();
  } catch (err) {
    if (err.name !== 'MongooseError') {
      console.warn('[MQTT Client] Failed to save telemetry doc:', err.message);
    }
  }

  // Safety Automation: If gate is CLOSING and photocell beam is broken / obstacle < 40cm, auto-reverse!
  const beamBroken = photocell.beamContinuity === false || currentGateState.obstacleDistanceCm < 40;
  if (currentGateState.status === 'CLOSING' && beamBroken) {
    console.warn(`[SAFETY TRIGGER] Photocell beam interrupted (${photocell.opticalSignalStrength}% optical signal)! Initiating safety reverse!`);
    publishCommand(homeId, currentGateState.gateId, 'SAFETY_REVERSE', 'Photocell safety beam interrupted');
  }
}

async function handleEventMessage(homeId, data) {
  const eventId = data.eventId || `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Avoid re-processing if already handled by internal pipeline
  if (data.source === 'SENSOR_TELEMETRY_PIPELINE' || data.alreadyHandled) {
    return;
  }

  console.log(`[EVENT RECEIVED] ${data.eventType} on ${homeId}:`, data.payload);

  // Automated credential verification for RFID scans and ALPR scans
  if (data.eventType === 'RFID_SCAN') {
    const tagId = data.payload?.tagId;
    const policy = await AccessPolicy.findOne({ identifier: tagId, isActive: true });

    if (policy) {
      console.log(`[ACCESS GRANTED] RFID ${tagId} belongs to ${policy.holderName} (${policy.userRole})`);
      data.eventType = 'RFID_ENTRY_SUCCESS';
      data.severity = 'INFO';
      data.payload.holderName = policy.holderName;
      data.payload.userRole = policy.userRole;

      // Automatically trigger gate OPEN command!
      publishCommand(homeId, data.gateId || 'gate_main_01', 'OPEN', `Authorized RFID: ${policy.holderName}`);

      // Dispatch email notification to particular recipient
      sendAuthorizedEntryNotification({
        policy,
        homeId,
        gateId: data.gateId || 'gate_main_01',
        credentialType: 'RFID_TAG',
        identifier: tagId,
        method: 'RFID_CONTACTLESS_SCAN',
        timestamp: new Date()
      }).catch(err => console.error('[MQTT Handler] Email notification failed:', err));
    } else {
      console.warn(`[ACCESS DENIED] Unrecognized or revoked RFID tag: ${tagId}`);
      data.eventType = 'RFID_ENTRY_DENIED';
      data.severity = 'WARN';
      data.payload.failureReason = 'Credential not registered or inactive in AccessPolicy';

      // Dispatch urgent security alert email for unauthorized entry attempt
      sendUnauthorizedAttemptNotification({
        homeId,
        gateId: data.gateId || 'gate_main_01',
        credentialType: 'RFID_TAG',
        identifier: tagId,
        method: 'RFID_CONTACTLESS_SCAN',
        reason: 'Unregistered or revoked RFID tag presented at gate pillar',
        timestamp: new Date()
      }).catch(err => console.error('[MQTT Handler] Unauthorized alert email failed:', err));
    }
  } else if (data.eventType === 'ALPR_SCAN') {
    const plateNumber = data.payload?.plateNumber?.toUpperCase().replace(/\s+/g, '');
    const policy = await AccessPolicy.findOne({ identifier: plateNumber, isActive: true });

    if (policy) {
      console.log(`[ACCESS GRANTED] Vehicle plate ${plateNumber} matched: ${policy.holderName}`);
      data.eventType = 'ALPR_ENTRY_SUCCESS';
      data.severity = 'INFO';
      data.payload.holderName = policy.holderName;
      data.payload.userRole = policy.userRole;

      publishCommand(homeId, data.gateId || 'gate_main_01', 'OPEN', `Authorized Vehicle Plate: ${policy.holderName}`);

      // Dispatch email notification to particular recipient
      sendAuthorizedEntryNotification({
        policy,
        homeId,
        gateId: data.gateId || 'gate_main_01',
        credentialType: 'LICENSE_PLATE',
        identifier: plateNumber,
        method: 'ALPR_VEHICLE_SCAN',
        timestamp: new Date()
      }).catch(err => console.error('[MQTT Handler] Email notification failed:', err));
    } else {
      console.warn(`[ACCESS DENIED] Unrecognized vehicle plate: ${plateNumber}`);
      data.eventType = 'ALPR_ENTRY_DENIED';
      data.severity = 'WARN';
      data.payload.failureReason = 'Unregistered vehicle license plate';

      // Dispatch urgent security alert email for unauthorized entry attempt
      sendUnauthorizedAttemptNotification({
        homeId,
        gateId: data.gateId || 'gate_main_01',
        credentialType: 'LICENSE_PLATE',
        identifier: plateNumber,
        method: 'ALPR_VEHICLE_SCAN',
        reason: 'Unregistered vehicle license plate detected at driveway ALPR',
        timestamp: new Date()
      }).catch(err => console.error('[MQTT Handler] Unauthorized alert email failed:', err));
    }
  } else if (data.eventType === 'TAMPER_ALARM' || data.eventType === 'PHYSICAL_BREACH') {
    console.warn(`[SECURITY ALERT] Enclosure tamper alarm detected! Sensor: ${data.sensorId}`);
    data.severity = 'CRITICAL';
    sendUnauthorizedAttemptNotification({
      homeId,
      gateId: data.gateId || 'gate_main_01',
      credentialType: 'PHYSICAL_BREACH',
      identifier: data.payload?.vibrationG ? `TAMPER_${data.payload.vibrationG}G` : 'HOUSING_ACCELEROMETER',
      method: 'TAMPER_VIBRATION_SENSOR',
      reason: data.payload?.notes || 'Critical physical tampering / vibration detected on gate control enclosure',
      timestamp: new Date()
    }).catch(err => console.error('[MQTT Handler] Tamper alert email failed:', err));
  } else if (data.eventType === 'UNAUTHORIZED_ENTRY' || data.eventType === 'INTRUSION_DETECTED') {
    console.warn(`[SECURITY ALERT] Unauthorized person intrusion detected!`);
    data.severity = 'CRITICAL';
    sendUnauthorizedAttemptNotification({
      homeId,
      gateId: data.gateId || 'gate_main_01',
      credentialType: data.payload?.credentialType || 'UNAUTHORIZED_PERSON',
      identifier: data.payload?.identifier || 'UNKNOWN_INTRUDER',
      method: data.payload?.method || 'PIR_PERIMETER_DETECTION',
      reason: data.payload?.reason || 'Unauthorized person entered property perimeter',
      timestamp: new Date()
    }).catch(err => console.error('[MQTT Handler] Intrusion alert email failed:', err));
  }

  // Persist event to MongoDB
  try {
    const eventDoc = new GateEvent({
      eventId: eventId,
      homeId: homeId,
      gateId: data.gateId || 'gate_main_01',
      eventType: data.eventType,
      severity: data.severity || 'INFO',
      sensorId: data.sensorId || 'sensor_unknown',
      source: data.source || 'MQTT_TELEMETRY',
      payload: data.payload || {},
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
    });
    await eventDoc.save();
  } catch (err) {
    console.warn('[MQTT Client] Failed to save event doc:', err.message);
  }
}

function handleStatusMessage(homeId, data) {
  if (data.status) {
    currentGateState.status = data.status;
    if (data.lockEngaged !== undefined) currentGateState.lockEngaged = data.lockEngaged;
    if (data.reedSwitchState) currentGateState.reedSwitchState = data.reedSwitchState;
    currentGateState.lastUpdated = new Date();
    notifyListeners();
  }
}

function publishCommand(homeId, gateId, action, reason = '') {
  if (!client || !client.connected) {
    console.warn('[MQTT Client] Cannot publish command: MQTT client not connected');
    return false;
  }

  const topic = `iothings/home/${homeId}/gate/commands`;
  const payload = JSON.stringify({
    commandId: `CMD-${Date.now()}`,
    gateId: gateId,
    action: action, // OPEN, CLOSE, LOCK, UNLOCK, STOP, SAFETY_REVERSE, HOLD_OPEN
    reason: reason,
    requestedAt: new Date().toISOString()
  });

  client.publish(topic, payload, { qos: 1 });
  console.log(`[MQTT Command Published] ${action} -> ${topic}`);
  return true;
}

function publishEvent(homeId, eventData) {
  if (!client || !client.connected) {
    console.warn('[MQTT Client] Cannot publish event: MQTT client not connected');
    return false;
  }

  const topic = `iothings/home/${homeId}/gate/events`;
  const payload = JSON.stringify(eventData);

  client.publish(topic, payload, { qos: 1 });
  console.log(`[MQTT Event Published] ${eventData.eventType || 'EVENT'} -> ${topic}`);
  return true;
}

module.exports = {
  initMqttClient,
  publishCommand,
  publishEvent,
  registerStateListener,
  getGateState: () => currentGateState,
  setGateState: (partial) => { currentGateState = { ...currentGateState, ...partial }; notifyListeners(); }
};
