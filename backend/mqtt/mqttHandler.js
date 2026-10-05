const mqtt = require('mqtt');
const GateEvent = require('../models/GateEvent');
const GateTelemetry = require('../models/GateTelemetry');
const AccessPolicy = require('../models/AccessPolicy');
const { sendUnauthorizedAttemptNotification } = require('../services/emailService');

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
    try {
      cb(currentGateState);
    } catch (e) {
      console.error('[state] Listener error:', e.message);
    }
  }
}

function initMqttClient(brokerUrl = 'mqtt://127.0.0.1:1883') {
  client = mqtt.connect(brokerUrl, {
    clientId: `iothings_backend_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 2000
  });

  client.on('connect', () => {
    console.log('[mqtt] Connected to broker; listening on iothings/home/+/gate/#');
    client.subscribe('iothings/home/+/gate/#', { qos: 1 }, (err) => {
      if (err) console.error('[mqtt] Subscription error:', err.message);
    });
  });

  client.on('message', async (topic, payloadBuffer) => {
    try {
      const data = JSON.parse(payloadBuffer.toString());
      const parts = topic.split('/');
      const homeId = parts[2] || 'home_uk_01';
      const category = parts[4];

      if (category === 'telemetry') {
        await handleTelemetryMessage(homeId, data);
      } else if (category === 'events') {
        await handleEventMessage(homeId, data);
      } else if (category === 'status') {
        handleStatusMessage(homeId, data);
      }
    } catch (err) {
      console.error(`[mqtt] Error parsing message on ${topic}:`, err.message);
    }
  });

  client.on('error', (err) => {
    console.error('[mqtt] Client error:', err.message);
  });

  return client;
}

async function handleTelemetryMessage(homeId, data) {
  const isClosed = (data.status === 'IDLE_CLOSED' || data.status === 'LOCKED');
  const isOpen = (data.status === 'OPEN');
  const defaultResting = isClosed ? 'FULLY_CLOSED' : (isOpen ? 'FULLY_OPEN' : 'AJAR');
  const defaultStandby = isClosed ? 2.1 : (isOpen ? 2.3 : 48.0);

  const photocell = data.photocell || {
    healthStatus: (data.metrics?.obstacleDistanceCm < 45 ? 'DIRTY_LENS_WARNING' : 'HEALTHY'),
    opticalSignalStrength: data.photocell?.opticalSignalStrength ?? (data.metrics?.obstacleDistanceCm < 45 ? 52.0 : 96.0),
    beamContinuity: data.photocell?.beamContinuity !== undefined ? data.photocell.beamContinuity : (data.metrics?.obstacleDistanceCm >= 45)
  };

  const limitSwitch = data.limitSwitch || {
    restingState: defaultResting,
    ambientMotorTemperatureC: data.metrics?.motorTemperatureC || 21.5,
    standbyPowerWatts: defaultStandby
  };

  const rfidReader = data.rfidReader || {
    operationalHeartbeat: true,
    antennaStatus: 'OPTIMAL',
    backgroundNoiseDbm: data.rfidReader?.backgroundNoiseDbm ?? -82.0
  };

  const reedSwitchState = data.metrics?.reedSwitchState || (isOpen ? 'OPEN' : (isClosed ? 'CLOSED' : 'AJAR'));

  currentGateState = {
    ...currentGateState,
    homeId,
    gateId: data.gateId || 'gate_main_01',
    status: data.status || currentGateState.status,
    lockEngaged: data.lockEngaged !== undefined ? data.lockEngaged : currentGateState.lockEngaged,
    obstacleDistanceCm: data.metrics?.obstacleDistanceCm || 250,
    pirMotionDetected: Boolean(data.metrics?.pirMotionDetected),
    reedSwitchState,
    motorCurrentAmps: data.metrics?.motorCurrentAmps || (isOpen || isClosed ? 0.0 : 3.8),
    photocell,
    limitSwitch,
    rfidReader,
    lastUpdated: new Date()
  };

  notifyListeners();

  try {
    const doc = new GateTelemetry({
      homeId,
      gateId: data.gateId || 'gate_main_01',
      status: currentGateState.status,
      photocell,
      limitSwitch,
      rfidReader,
      metrics: {
        obstacleDistanceCm: data.metrics?.obstacleDistanceCm ?? 250,
        pirMotionDetected: Boolean(data.metrics?.pirMotionDetected),
        reedSwitchState,
        motorCurrentAmps: data.metrics?.motorCurrentAmps || (isOpen || isClosed ? 0.0 : 3.8),
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
      console.warn('[telemetry] Failed to record reading:', err.message);
    }
  }

  // Safety trigger: if gate is closing and beam is broken, auto-reverse
  const beamBroken = photocell.beamContinuity === false || currentGateState.obstacleDistanceCm < 40;
  if (currentGateState.status === 'CLOSING' && beamBroken) {
    console.warn(`[safety] Photocell beam interrupted during closing sequence. Triggering auto-reverse.`);
    publishCommand(homeId, currentGateState.gateId, 'SAFETY_REVERSE', 'Photocell safety beam interrupted');
  }
}

async function handleEventMessage(homeId, data) {
  const eventId = data.eventId || `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (data.source === 'SENSOR_TELEMETRY_PIPELINE' || data.alreadyHandled) {
    return;
  }

  console.log(`[event] ${data.eventType} (${homeId})`);

  if (data.eventType === 'RFID_SCAN') {
    const tagId = data.payload?.tagId;
    const policy = await AccessPolicy.findOne({ identifier: tagId, isActive: true });

    if (policy) {
      console.log(`[access] Granted for ${policy.holderName} (${policy.userRole}) via RFID ${tagId}`);
      data.eventType = 'RFID_ENTRY_SUCCESS';
      data.severity = 'INFO';
      data.payload.holderName = policy.holderName;
      data.payload.userRole = policy.userRole;

      publishCommand(homeId, data.gateId || 'gate_main_01', 'OPEN', `Authorized RFID: ${policy.holderName}`);
    } else {
      console.warn(`[access] Denied: unrecognized RFID tag ${tagId}`);
      data.eventType = 'RFID_ENTRY_DENIED';
      data.severity = 'WARN';
      data.payload.failureReason = 'Credential not registered or inactive in AccessPolicy';

      sendUnauthorizedAttemptNotification({
        homeId,
        gateId: data.gateId || 'gate_main_01',
        credentialType: 'RFID_TAG',
        identifier: tagId,
        method: 'RFID_CONTACTLESS_SCAN',
        reason: 'Unregistered or revoked RFID tag presented at gate pillar',
        timestamp: new Date()
      }).catch(err => console.error('[notifications] Alert dispatch failed:', err.message));
    }
  } else if (data.eventType === 'ALPR_SCAN') {
    const plateNumber = data.payload?.plateNumber?.toUpperCase().replace(/\s+/g, '');
    const policy = await AccessPolicy.findOne({ identifier: plateNumber, isActive: true });

    if (policy) {
      console.log(`[access] Granted for ${policy.holderName} via plate ${plateNumber}`);
      data.eventType = 'ALPR_ENTRY_SUCCESS';
      data.severity = 'INFO';
      data.payload.holderName = policy.holderName;
      data.payload.userRole = policy.userRole;

      publishCommand(homeId, data.gateId || 'gate_main_01', 'OPEN', `Authorized Vehicle Plate: ${policy.holderName}`);
    } else {
      console.warn(`[access] Denied: unregistered plate ${plateNumber}`);
      data.eventType = 'ALPR_ENTRY_DENIED';
      data.severity = 'WARN';
      data.payload.failureReason = 'Unregistered vehicle license plate';

      sendUnauthorizedAttemptNotification({
        homeId,
        gateId: data.gateId || 'gate_main_01',
        credentialType: 'LICENSE_PLATE',
        identifier: plateNumber,
        method: 'ALPR_VEHICLE_SCAN',
        reason: 'Unregistered vehicle license plate detected at driveway ALPR',
        timestamp: new Date()
      }).catch(err => console.error('[notifications] Alert dispatch failed:', err.message));
    }
  } else if (data.eventType === 'TAMPER_ALARM' || data.eventType === 'PHYSICAL_BREACH') {
    console.warn(`[security] Enclosure tamper alarm on ${data.sensorId}`);
    data.severity = 'CRITICAL';
    sendUnauthorizedAttemptNotification({
      homeId,
      gateId: data.gateId || 'gate_main_01',
      credentialType: 'PHYSICAL_BREACH',
      identifier: data.payload?.vibrationG ? `TAMPER_${data.payload.vibrationG}G` : 'HOUSING_ACCELEROMETER',
      method: 'TAMPER_VIBRATION_SENSOR',
      reason: data.payload?.notes || 'Physical shock detected on gate controller enclosure',
      timestamp: new Date()
    }).catch(err => console.error('[notifications] Tamper alert failed:', err.message));
  } else if (data.eventType === 'UNAUTHORIZED_ENTRY' || data.eventType === 'INTRUSION_DETECTED') {
    console.warn(`[security] Perimeter intrusion detected`);
    data.severity = 'CRITICAL';
    sendUnauthorizedAttemptNotification({
      homeId,
      gateId: data.gateId || 'gate_main_01',
      credentialType: data.payload?.credentialType || 'UNAUTHORIZED_PERSON',
      identifier: data.payload?.identifier || 'UNKNOWN_INTRUDER',
      method: data.payload?.method || 'PIR_PERIMETER_DETECTION',
      reason: data.payload?.reason || 'Unauthorized person entered property perimeter',
      timestamp: new Date()
    }).catch(err => console.error('[notifications] Intrusion alert failed:', err.message));
  }

  try {
    const eventDoc = new GateEvent({
      eventId,
      homeId,
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
    console.warn('[events] Failed to persist event:', err.message);
  }
}

let actuationTimer = null;
let autoCloseTimer = null;

function handleStatusMessage(homeId, data) {
  if (data.status) {
    currentGateState.status = data.status;
    if (data.lockEngaged !== undefined) currentGateState.lockEngaged = data.lockEngaged;

    const isClosed = (data.status === 'LOCKED' || data.status === 'IDLE_CLOSED');
    const isOpen = (data.status === 'OPEN');

    if (data.reedSwitchState) {
      currentGateState.reedSwitchState = data.reedSwitchState;
    } else {
      currentGateState.reedSwitchState = isOpen ? 'OPEN' : (isClosed ? 'CLOSED' : 'AJAR');
    }

    const restingState = isClosed ? 'FULLY_CLOSED' : (isOpen ? 'FULLY_OPEN' : 'AJAR');
    const standbyPowerWatts = isClosed ? 2.1 : (isOpen ? 2.3 : 48.0);

    currentGateState.limitSwitch = {
      ...currentGateState.limitSwitch,
      restingState,
      standbyPowerWatts
    };

    currentGateState.lastUpdated = new Date();
    notifyListeners();
  }
}

async function persistTelemetryDoc(status, restingState, reedState, standbyPower) {
  try {
    const doc = new GateTelemetry({
      homeId: currentGateState.homeId || 'home_uk_01',
      gateId: currentGateState.gateId || 'gate_main_01',
      status,
      lockEngaged: (status === 'LOCKED' || status === 'IDLE_CLOSED'),
      photocell: currentGateState.photocell,
      limitSwitch: {
        restingState,
        ambientMotorTemperatureC: currentGateState.limitSwitch.ambientMotorTemperatureC,
        standbyPowerWatts: standbyPower
      },
      rfidReader: currentGateState.rfidReader,
      metrics: {
        obstacleDistanceCm: currentGateState.obstacleDistanceCm,
        pirMotionDetected: currentGateState.pirMotionDetected,
        reedSwitchState: reedState,
        motorCurrentAmps: currentGateState.motorCurrentAmps,
        motorTemperatureC: currentGateState.limitSwitch.ambientMotorTemperatureC,
        batteryBackupVoltage: 12.8,
        ambientLightLux: 520,
        tamperVibrationG: 0.02
      },
      timestamp: new Date()
    });
    await doc.save();
  } catch {
    // Non-fatal logging
  }
}

function executeActuationSequence(homeId, gateId, action) {
  if (action === 'HOLD_OPEN') {
    if (actuationTimer) clearTimeout(actuationTimer);
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    currentGateState = {
      ...currentGateState,
      status: 'OPEN',
      lockEngaged: false,
      reedSwitchState: 'OPEN',
      motorCurrentAmps: 0.0,
      limitSwitch: {
        ...currentGateState.limitSwitch,
        restingState: 'FULLY_OPEN',
        standbyPowerWatts: 2.3
      },
      lastUpdated: new Date()
    };
    notifyListeners();
    persistTelemetryDoc('OPEN', 'FULLY_OPEN', 'OPEN', 2.3);
    return;
  }

  if (action === 'OPEN') {
    if (actuationTimer) clearTimeout(actuationTimer);
    if (autoCloseTimer) clearTimeout(autoCloseTimer);

    currentGateState = {
      ...currentGateState,
      status: 'OPENING',
      lockEngaged: false,
      reedSwitchState: 'AJAR',
      motorCurrentAmps: 3.8,
      limitSwitch: {
        ...currentGateState.limitSwitch,
        restingState: 'AJAR',
        standbyPowerWatts: 48.0
      },
      lastUpdated: new Date()
    };
    notifyListeners();

    actuationTimer = setTimeout(() => {
      currentGateState = {
        ...currentGateState,
        status: 'OPEN',
        lockEngaged: false,
        reedSwitchState: 'OPEN',
        motorCurrentAmps: 0.0,
        limitSwitch: {
          ...currentGateState.limitSwitch,
          restingState: 'FULLY_OPEN',
          standbyPowerWatts: 2.3
        },
        lastUpdated: new Date()
      };
      notifyListeners();
      persistTelemetryDoc('OPEN', 'FULLY_OPEN', 'OPEN', 2.3);

      autoCloseTimer = setTimeout(() => {
        executeActuationSequence(homeId, gateId, 'CLOSE');
      }, 12000);
    }, 3500);

    return;
  }

  if (action === 'CLOSE') {
    if (actuationTimer) clearTimeout(actuationTimer);
    if (autoCloseTimer) clearTimeout(autoCloseTimer);

    currentGateState = {
      ...currentGateState,
      status: 'CLOSING',
      lockEngaged: false,
      reedSwitchState: 'AJAR',
      motorCurrentAmps: 4.1,
      limitSwitch: {
        ...currentGateState.limitSwitch,
        restingState: 'AJAR',
        standbyPowerWatts: 48.0
      },
      lastUpdated: new Date()
    };
    notifyListeners();

    actuationTimer = setTimeout(() => {
      currentGateState = {
        ...currentGateState,
        status: 'LOCKED',
        lockEngaged: true,
        reedSwitchState: 'CLOSED',
        motorCurrentAmps: 0.0,
        limitSwitch: {
          ...currentGateState.limitSwitch,
          restingState: 'FULLY_CLOSED',
          standbyPowerWatts: 2.1
        },
        lastUpdated: new Date()
      };
      notifyListeners();
      persistTelemetryDoc('LOCKED', 'FULLY_CLOSED', 'CLOSED', 2.1);
    }, 3500);
    return;
  }

  if (action === 'LOCK') {
    if (actuationTimer) clearTimeout(actuationTimer);
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    currentGateState = {
      ...currentGateState,
      status: 'LOCKED',
      lockEngaged: true,
      reedSwitchState: 'CLOSED',
      motorCurrentAmps: 0.0,
      limitSwitch: {
        ...currentGateState.limitSwitch,
        restingState: 'FULLY_CLOSED',
        standbyPowerWatts: 2.1
      },
      lastUpdated: new Date()
    };
    notifyListeners();
    persistTelemetryDoc('LOCKED', 'FULLY_CLOSED', 'CLOSED', 2.1);
    return;
  }

  if (action === 'UNLOCK') {
    currentGateState = {
      ...currentGateState,
      status: 'IDLE_CLOSED',
      lockEngaged: false,
      reedSwitchState: 'CLOSED',
      motorCurrentAmps: 0.0,
      limitSwitch: {
        ...currentGateState.limitSwitch,
        restingState: 'FULLY_CLOSED',
        standbyPowerWatts: 2.1
      },
      lastUpdated: new Date()
    };
    notifyListeners();
    return;
  }

  if (action === 'STOP') {
    if (actuationTimer) clearTimeout(actuationTimer);
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    currentGateState = {
      ...currentGateState,
      motorCurrentAmps: 0.0,
      lastUpdated: new Date()
    };
    notifyListeners();
  }
}

function publishCommand(homeId, gateId, action, reason = '') {
  executeActuationSequence(homeId, gateId, action);

  if (!client || !client.connected) {
    return true;
  }

  const topic = `iothings/home/${homeId}/gate/commands`;
  const payload = JSON.stringify({
    commandId: `CMD-${Date.now()}`,
    gateId,
    action,
    reason,
    requestedAt: new Date().toISOString()
  });

  client.publish(topic, payload, { qos: 1 });
  console.log(`[mqtt:cmd] ${action} -> ${topic}`);
  return true;
}

function publishEvent(homeId, eventData) {
  if (!client || !client.connected) {
    return false;
  }

  const topic = `iothings/home/${homeId}/gate/events`;
  const payload = JSON.stringify(eventData);

  client.publish(topic, payload, { qos: 1 });
  console.log(`[mqtt:event] ${eventData.eventType || 'EVENT'} -> ${topic}`);
  return true;
}

function publishTelemetry(homeId, telemetryData) {
  if (!client || !client.connected) {
    return false;
  }

  const topic = `iothings/home/${homeId}/gate/telemetry`;
  const payload = JSON.stringify(telemetryData);

  client.publish(topic, payload, { qos: 0 });
  return true;
}

module.exports = {
  initMqttClient,
  publishCommand,
  publishEvent,
  publishTelemetry,
  registerStateListener,
  getGateState: () => currentGateState,
  setGateState: (partial) => {
    currentGateState = { ...currentGateState, ...partial };
    notifyListeners();
  }
};
