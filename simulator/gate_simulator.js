const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const HOME_ID = process.env.HOME_ID || 'home_uk_01';
const GATE_ID = process.env.GATE_ID || 'gate_main_01';
const TELEMETRY_INTERVAL_MS = parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000;

console.log('[simulator] Connecting hardware simulator to MQTT broker at', BROKER_URL);

const client = mqtt.connect(BROKER_URL, {
  clientId: `hw_sim_${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 2000
});

let gateState = {
  status: 'LOCKED',
  lockEngaged: true,
  reedSwitchState: 'CLOSED',
  obstacleDistanceCm: 280,
  pirMotionDetected: false,
  motorCurrentAmps: 0.0,
  motorTemperatureC: 21.5,
  batteryBackupVoltage: 12.8,
  tamperVibrationG: 0.02
};

let autoCloseTimer = null;
let movementInterval = null;
let simTelemetryCycle = 0;

client.on('connect', () => {
  console.log('[simulator] Connected to broker. Subscribed to gate commands.');
  console.log(`[simulator] Telemetry broadcast cadence: ${TELEMETRY_INTERVAL_MS / 1000}s`);

  const commandTopic = `iothings/home/${HOME_ID}/gate/commands`;
  client.subscribe(commandTopic, { qos: 1 });

  publishTelemetry();
  setInterval(publishTelemetry, TELEMETRY_INTERVAL_MS);
  setInterval(simulateRealisticTraffic, 35000);
});

client.on('message', (topic, message) => {
  try {
    const cmd = JSON.parse(message.toString());
    console.log(`[simulator] Command received: ${cmd.action} (${cmd.reason || 'manual'})`);
    executeCommand(cmd.action);
  } catch (err) {
    console.error('[simulator] Failed to parse command:', err.message);
  }
});

function executeCommand(action) {
  switch (action) {
    case 'OPEN':
      initiateOpenSequence();
      break;
    case 'CLOSE':
      initiateCloseSequence();
      break;
    case 'SAFETY_REVERSE':
      handleSafetyReverse();
      break;
    case 'STOP':
      stopMotor();
      break;
    case 'LOCK':
      if (gateState.status === 'IDLE_CLOSED') {
        gateState.lockEngaged = true;
        gateState.status = 'LOCKED';
        publishStatus();
        console.log('[simulator] Deadbolt locked');
      }
      break;
    case 'UNLOCK':
      if (gateState.status === 'LOCKED') {
        gateState.lockEngaged = false;
        gateState.status = 'IDLE_CLOSED';
        publishStatus();
        console.log('[simulator] Deadbolt unlocked');
      }
      break;
    case 'HOLD_OPEN':
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      gateState.status = 'OPEN';
      gateState.reedSwitchState = 'OPEN';
      gateState.motorCurrentAmps = 0.0;
      gateState.lockEngaged = false;
      publishStatus();
      publishTelemetry();
      console.log('[simulator] Gate held in open position');
      break;
  }
}

function initiateOpenSequence() {
  if (gateState.status === 'OPENING' || gateState.status === 'OPEN') return;

  if (movementInterval) clearInterval(movementInterval);
  if (autoCloseTimer) clearTimeout(autoCloseTimer);

  gateState.lockEngaged = false;
  gateState.status = 'OPENING';
  gateState.reedSwitchState = 'AJAR';
  gateState.motorCurrentAmps = 3.8;
  publishStatus();

  let step = 0;
  movementInterval = setInterval(() => {
    step++;
    if (step >= 5) {
      clearInterval(movementInterval);
      gateState.status = 'OPEN';
      gateState.reedSwitchState = 'OPEN';
      gateState.motorCurrentAmps = 0.0;
      publishStatus();
      publishTelemetry();
      console.log('[simulator] Gate reached FULLY_OPEN limit');

      autoCloseTimer = setTimeout(() => {
        initiateCloseSequence();
      }, 12000);
    }
  }, 1000);
}

function initiateCloseSequence() {
  if (gateState.status === 'CLOSING' || gateState.status === 'IDLE_CLOSED' || gateState.status === 'LOCKED') return;

  if (movementInterval) clearInterval(movementInterval);

  gateState.status = 'CLOSING';
  gateState.reedSwitchState = 'AJAR';
  gateState.motorCurrentAmps = 4.1;
  publishStatus();

  let step = 0;
  movementInterval = setInterval(() => {
    step++;

    if (gateState.obstacleDistanceCm < 45) {
      clearInterval(movementInterval);
      handleSafetyReverse();
      return;
    }

    if (step >= 5) {
      clearInterval(movementInterval);
      gateState.status = 'IDLE_CLOSED';
      gateState.reedSwitchState = 'CLOSED';
      gateState.motorCurrentAmps = 0.0;
      gateState.lockEngaged = true;
      gateState.status = 'LOCKED';
      publishStatus();
      publishTelemetry();
      console.log('[simulator] Gate reached FULLY_CLOSED limit; locked');
    }
  }, 1000);
}

function handleSafetyReverse() {
  if (movementInterval) clearInterval(movementInterval);
  console.warn('[simulator] Obstacle detected during close. Executing safety reverse.');
  gateState.status = 'OBSTACLE_HOLD';
  gateState.motorCurrentAmps = 0.0;
  publishStatus();

  setTimeout(() => {
    initiateOpenSequence();
  }, 1000);
}

function stopMotor() {
  if (movementInterval) clearInterval(movementInterval);
  if (autoCloseTimer) clearTimeout(autoCloseTimer);
  gateState.motorCurrentAmps = 0.0;
  gateState.status = 'IDLE_CLOSED';
  publishStatus();
  console.log('[simulator] Motor stopped');
}

function publishTelemetry() {
  if (!client.connected) return;

  simTelemetryCycle++;

  const noise = (Math.random() - 0.5) * 4;
  const temp = parseFloat((gateState.motorTemperatureC + (Math.random() - 0.5) * 0.2).toFixed(1));

  let status = gateState.status;
  let lockEngaged = gateState.lockEngaged;
  let reedSwitchState = gateState.reedSwitchState;
  let motorCurrentAmps = gateState.motorCurrentAmps;
  let distance = Math.max(10, Math.round(gateState.obstacleDistanceCm + noise));
  let pirMotion = gateState.pirMotionDetected;
  let opticalSignal = 96.0;
  let photocellHealth = 'HEALTHY';
  let beamContinuity = true;
  let antennaStatus = 'OPTIMAL';
  let backgroundNoise = -82.5;

  if (!movementInterval) {
    const cycleMode = simTelemetryCycle % 6;
    if (cycleMode === 0) {
      status = 'LOCKED';
      lockEngaged = true;
      reedSwitchState = 'CLOSED';
      motorCurrentAmps = 0.0;
      distance = 260 + Math.round((Math.random() - 0.5) * 10);
      pirMotion = false;
      beamContinuity = true;
      opticalSignal = 96.5;
      photocellHealth = 'HEALTHY';
      antennaStatus = 'OPTIMAL';
      backgroundNoise = -83.5;
    } else if (cycleMode === 1) {
      status = 'OPENING';
      lockEngaged = false;
      reedSwitchState = 'AJAR';
      motorCurrentAmps = parseFloat((3.7 + Math.random() * 0.4).toFixed(2));
      distance = 240;
      pirMotion = true;
      beamContinuity = true;
      opticalSignal = 94.0;
      photocellHealth = 'HEALTHY';
      antennaStatus = 'OPTIMAL';
      backgroundNoise = -82.0;
    } else if (cycleMode === 2) {
      status = 'OPEN';
      lockEngaged = false;
      reedSwitchState = 'OPEN';
      motorCurrentAmps = 0.0;
      distance = 280;
      pirMotion = true;
      beamContinuity = true;
      opticalSignal = 96.0;
      photocellHealth = 'HEALTHY';
      antennaStatus = 'OPTIMAL';
      backgroundNoise = -84.0;
    } else if (cycleMode === 3) {
      status = 'OPEN';
      lockEngaged = false;
      reedSwitchState = 'OPEN';
      motorCurrentAmps = 0.0;
      distance = 34;
      pirMotion = true;
      beamContinuity = false;
      opticalSignal = 18.0;
      photocellHealth = 'HEALTHY';
      antennaStatus = 'OPTIMAL';
      backgroundNoise = -81.0;
    } else if (cycleMode === 4) {
      status = 'CLOSING';
      lockEngaged = false;
      reedSwitchState = 'AJAR';
      motorCurrentAmps = parseFloat((4.0 + Math.random() * 0.3).toFixed(2));
      distance = 255;
      pirMotion = false;
      beamContinuity = true;
      opticalSignal = 95.0;
      photocellHealth = 'HEALTHY';
      antennaStatus = 'OPTIMAL';
      backgroundNoise = -83.0;
    } else if (cycleMode === 5) {
      status = 'IDLE_CLOSED';
      lockEngaged = true;
      reedSwitchState = 'CLOSED';
      motorCurrentAmps = 0.0;
      distance = 265;
      pirMotion = false;
      beamContinuity = true;
      opticalSignal = 64.0;
      photocellHealth = 'DIRTY_LENS_WARNING';
      antennaStatus = 'DETUNED';
      backgroundNoise = -62.0;
    }

    gateState.status = status;
    gateState.lockEngaged = lockEngaged;
    gateState.reedSwitchState = reedSwitchState;
    gateState.motorCurrentAmps = motorCurrentAmps;
    gateState.obstacleDistanceCm = distance;
    gateState.pirMotionDetected = pirMotion;
  } else {
    beamContinuity = distance >= 45;
    opticalSignal = beamContinuity ? 96.0 : 18.0;
    photocellHealth = beamContinuity ? 'HEALTHY' : 'OBSTRUCTED';
  }

  const isClosed = (status === 'LOCKED' || status === 'IDLE_CLOSED');
  const isOpen = (status === 'OPEN');
  const restingState = isClosed ? 'FULLY_CLOSED' : (isOpen ? 'FULLY_OPEN' : 'AJAR');
  const standbyPowerWatts = isClosed ? 2.1 : (isOpen ? 2.3 : 48.0);

  const photocell = {
    healthStatus: photocellHealth,
    opticalSignalStrength: opticalSignal,
    beamContinuity
  };

  const limitSwitch = {
    restingState,
    ambientMotorTemperatureC: temp,
    standbyPowerWatts
  };

  const rfidReader = {
    operationalHeartbeat: true,
    antennaStatus,
    backgroundNoiseDbm: backgroundNoise
  };

  const payload = {
    gateId: GATE_ID,
    homeId: HOME_ID,
    status,
    lockEngaged,
    photocell,
    limitSwitch,
    rfidReader,
    metrics: {
      obstacleDistanceCm: distance,
      pirMotionDetected: pirMotion,
      reedSwitchState,
      motorCurrentAmps,
      motorTemperatureC: temp,
      batteryBackupVoltage: 12.8,
      ambientLightLux: 520,
      tamperVibrationG: gateState.tamperVibrationG
    },
    timestamp: new Date().toISOString()
  };

  const topic = `iothings/home/${HOME_ID}/gate/telemetry`;
  client.publish(topic, JSON.stringify(payload), { qos: 0 });
  console.log(`[simulator] Telemetry published: status=${status}, limit=${limitSwitch.restingState}, beam=${beamContinuity ? 'ok' : 'cut'}`);
}

function publishStatus() {
  if (!client.connected) return;
  const topic = `iothings/home/${HOME_ID}/gate/status`;
  client.publish(topic, JSON.stringify({
    gateId: GATE_ID,
    status: gateState.status,
    lockEngaged: gateState.lockEngaged,
    reedSwitchState: gateState.reedSwitchState,
    timestamp: new Date().toISOString()
  }), { qos: 1 });
}

let cycleCount = 0;
function simulateRealisticTraffic() {
  cycleCount++;
  const events = [
    { type: 'RFID_SCAN', payload: { tagId: 'RFID-8842-A' } },
    { type: 'ALPR_SCAN', payload: { plateNumber: 'BC24-UKS' } },
    { type: 'RFID_SCAN', payload: { tagId: 'UNKNOWN-CLONE-99' } },
    { type: 'RFID_SCAN', payload: { tagId: 'RFID-1029-C' } },
    { type: 'ALPR_SCAN', payload: { plateNumber: 'DPD-998-UK' } },
    { type: 'ALPR_SCAN', payload: { plateNumber: 'UNKNOWN-VAN-77' } }
  ];

  const pick = events[cycleCount % events.length];
  const eventTopic = `iothings/home/${HOME_ID}/gate/events`;

  gateState.pirMotionDetected = true;
  setTimeout(() => { gateState.pirMotionDetected = false; }, 6000);

  const eventPayload = {
    eventId: `HW-SIM-${Date.now()}`,
    gateId: GATE_ID,
    eventType: pick.type,
    sensorId: pick.type === 'RFID_SCAN' ? 'sensor_rfid_pillar' : 'sensor_alpr_cam01',
    payload: pick.payload,
    timestamp: new Date().toISOString()
  };

  client.publish(eventTopic, JSON.stringify(eventPayload), { qos: 1 });
  console.log(`[simulator] Simulated arrival: ${pick.type} ->`, pick.payload);
}
