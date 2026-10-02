const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const HOME_ID = 'home_uk_01';
const GATE_ID = 'gate_main_01';

console.log('[Simulator] Starting Main Gate Hardware Simulator...');

const client = mqtt.connect(BROKER_URL, {
  clientId: `hardware_simulator_${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 2000
});

// Hardware state representation
let gateState = {
  status: 'LOCKED', // LOCKED, IDLE_CLOSED, OPENING, OPEN, CLOSING, OBSTACLE_HOLD
  lockEngaged: true,
  reedSwitchState: 'CLOSED', // CLOSED, AJAR, OPEN
  obstacleDistanceCm: 280,   // Driveway clearance
  pirMotionDetected: false,
  motorCurrentAmps: 0.0,
  motorTemperatureC: 21.5,
  batteryBackupVoltage: 12.8,
  tamperVibrationG: 0.02
};

let autoCloseTimer = null;
let movementInterval = null;

const TELEMETRY_INTERVAL_MS = parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000; // 15 seconds default (15,000 ms)

client.on('connect', () => {
  console.log('[Simulator] Connected to MQTT Broker! Listening for gate commands...');
  console.log(`[Simulator] Continuous telemetry generation configured for every ${TELEMETRY_INTERVAL_MS / 1000}s (${TELEMETRY_INTERVAL_MS} ms).`);

  // Subscribe to commands topic
  const commandTopic = `iothings/home/${HOME_ID}/gate/commands`;
  client.subscribe(commandTopic, { qos: 1 });

  // Publish first telemetry reading immediately on startup
  publishTelemetry();

  // Start continuous telemetry loop at 5 minutes interval
  setInterval(publishTelemetry, TELEMETRY_INTERVAL_MS);

  // Start autonomous event cycle (simulate cars / RFID arrivals)
  setInterval(simulateRealisticTraffic, 35000);
});

client.on('message', (topic, message) => {
  try {
    const cmd = JSON.parse(message.toString());
    console.log(`[Simulator] Received command: ${cmd.action} (Reason: ${cmd.reason || 'N/A'})`);
    executeCommand(cmd.action);
  } catch (err) {
    console.error('[Simulator] Command parsing error:', err.message);
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
        console.log('[Simulator] Magnetic deadbolt locked.');
      }
      break;
    case 'UNLOCK':
      if (gateState.status === 'LOCKED') {
        gateState.lockEngaged = false;
        gateState.status = 'IDLE_CLOSED';
        publishStatus();
        console.log('[Simulator] Magnetic deadbolt disengaged.');
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
      console.log('[Simulator] Gate held in permanent open position (FULLY_OPEN).');
      break;
  }
}

function initiateOpenSequence() {
  if (gateState.status === 'OPENING' || gateState.status === 'OPEN') return;

  if (movementInterval) clearInterval(movementInterval);
  if (autoCloseTimer) clearTimeout(autoCloseTimer);

  console.log('[Simulator] Disengaging magnetic lock and starting motor opening cycle...');
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
      console.log('[Simulator] Gate reached FULLY OPEN position. Emitted FULLY_OPEN telemetry.');

      // Auto-close after 12 seconds
      autoCloseTimer = setTimeout(() => {
        initiateCloseSequence();
      }, 12000);
    }
  }, 1000);
}

function initiateCloseSequence() {
  if (gateState.status === 'CLOSING' || gateState.status === 'IDLE_CLOSED' || gateState.status === 'LOCKED') return;

  if (movementInterval) clearInterval(movementInterval);

  console.log('[Simulator] Warning strobe active. Starting motor closing cycle...');
  gateState.status = 'CLOSING';
  gateState.reedSwitchState = 'AJAR';
  gateState.motorCurrentAmps = 4.1;
  publishStatus();

  let step = 0;
  movementInterval = setInterval(() => {
    step++;

    // Safety check during closure
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
      console.log('[Simulator] Gate fully closed and magnetic lock engaged. Emitted FULLY_CLOSED telemetry.');
    }
  }, 1000);
}

function handleSafetyReverse() {
  if (movementInterval) clearInterval(movementInterval);
  console.warn('[Simulator] SAFETY REVERSE TRIGGERED! Obstacle detected in path.');
  gateState.status = 'OBSTACLE_HOLD';
  gateState.motorCurrentAmps = 0.0;
  publishStatus();

  // Reverse back to open after 1s pause
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
  console.log('[Simulator] Motor stopped immediately.');
}

let simTelemetryCycle = 0;

function publishTelemetry() {
  if (!client.connected) return;

  simTelemetryCycle++;

  // Add realistic jitter
  const noise = (Math.random() - 0.5) * 4;
  const temp = parseFloat((gateState.motorTemperatureC + (Math.random() - 0.5) * 0.2).toFixed(1));

  // Mixed operational telemetry cycle across 15-second intervals:
  // Dynamically rotates through realistic states: FULLY_CLOSED, FULLY_OPEN, AJAR,
  // with varying photocell beam conditions (HEALTHY, OBSTRUCTED, DIRTY_LENS) and RFID noise.
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

  // When not currently executing an active physical motor movement, cycle through realistic mixed profiles
  if (!movementInterval) {
    const cycleMode = simTelemetryCycle % 6;
    if (cycleMode === 0) {
      // 1. Resting Locked Standby (FULLY_CLOSED)
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
      // 2. Gate Opening Transit (AJAR)
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
      // 3. Resting Fully Open (FULLY_OPEN - Resident / Delivery Hold)
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
      // 4. Fully Open with Vehicle Traversal (FULLY_OPEN, Optical Beam Broken)
      status = 'OPEN';
      lockEngaged = false;
      reedSwitchState = 'OPEN';
      motorCurrentAmps = 0.0;
      distance = 34; // Vehicle traversing photocell beam
      pirMotion = true;
      beamContinuity = false;
      opticalSignal = 18.0;
      photocellHealth = 'HEALTHY';
      antennaStatus = 'OPTIMAL';
      backgroundNoise = -81.0;
    } else if (cycleMode === 4) {
      // 5. Gate Closing Transit (AJAR)
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
      // 6. Resting Closed with Sensor Variation (FULLY_CLOSED, Dirty Lens Warning, RFID Noise)
      status = 'IDLE_CLOSED';
      lockEngaged = true;
      reedSwitchState = 'CLOSED';
      motorCurrentAmps = 0.0;
      distance = 265;
      pirMotion = false;
      beamContinuity = true;
      opticalSignal = 64.0; // Dust accumulation on photocell lens
      photocellHealth = 'DIRTY_LENS_WARNING';
      antennaStatus = 'DETUNED'; // Transient electromagnetic noise spike
      backgroundNoise = -62.0;
    }

    // Update in-memory gateState
    gateState.status = status;
    gateState.lockEngaged = lockEngaged;
    gateState.reedSwitchState = reedSwitchState;
    gateState.motorCurrentAmps = motorCurrentAmps;
    gateState.obstacleDistanceCm = distance;
    gateState.pirMotionDetected = pirMotion;
  } else {
    // Actively commanded movement
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
    beamContinuity: beamContinuity
  };

  const limitSwitch = {
    restingState,
    ambientMotorTemperatureC: temp,
    standbyPowerWatts
  };

  const rfidReader = {
    operationalHeartbeat: true,
    antennaStatus: antennaStatus,
    backgroundNoiseDbm: backgroundNoise
  };

  const payload = {
    gateId: GATE_ID,
    homeId: HOME_ID,
    status: status,
    lockEngaged: lockEngaged,
    photocell,
    limitSwitch,
    rfidReader,
    metrics: {
      obstacleDistanceCm: distance,
      pirMotionDetected: pirMotion,
      reedSwitchState: reedSwitchState,
      motorCurrentAmps: motorCurrentAmps,
      motorTemperatureC: temp,
      batteryBackupVoltage: 12.8,
      ambientLightLux: 520,
      tamperVibrationG: gateState.tamperVibrationG
    },
    timestamp: new Date().toISOString()
  };

  const topic = `iothings/home/${HOME_ID}/gate/telemetry`;
  client.publish(topic, JSON.stringify(payload), { qos: 0 });
  console.log(`[Simulator] [${new Date().toLocaleTimeString()}] Published mixed telemetry (Cycle #${simTelemetryCycle}): LimitSwitch=${limitSwitch.restingState} (${limitSwitch.standbyPowerWatts}W) | Status=${status} | Reed=${reedSwitchState} | Photocell=${photocell.opticalSignalStrength}% (${photocell.healthStatus}, Beam=${beamContinuity ? 'CLEAR' : 'CUT'}) | RFID=${rfidReader.backgroundNoiseDbm}dBm (${rfidReader.antennaStatus})`);
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

// Autonomous realistic simulation cycle
let cycleCount = 0;
function simulateRealisticTraffic() {
  cycleCount++;
  const events = [
    {
      type: 'RFID_SCAN',
      payload: { tagId: 'RFID-8842-A' } // Resident Pramod
    },
    {
      type: 'ALPR_SCAN',
      payload: { plateNumber: 'BC24-UKS' } // Resident Audi Q5
    },
    {
      type: 'RFID_SCAN',
      payload: { tagId: 'UNKNOWN-CLONE-99' } // Unauthorized Intruder RFID tag
    },
    {
      type: 'RFID_SCAN',
      payload: { tagId: 'RFID-1029-C' } // Resident Mark Davies
    },
    {
      type: 'ALPR_SCAN',
      payload: { plateNumber: 'DPD-998-UK' } // Delivery Van
    },
    {
      type: 'ALPR_SCAN',
      payload: { plateNumber: 'UNKNOWN-VAN-77' } // Unauthorized vehicle plate
    }
  ];

  const pick = events[cycleCount % events.length];
  const eventTopic = `iothings/home/${HOME_ID}/gate/events`;

  // Brief motion detector activation before badge/vehicle scan
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
  console.log(`[Simulator] Simulated external arrival: ${pick.type} ->`, pick.payload);
}
