#!/usr/bin/env node
/**
 * IoThings Continuous Sensor Data Generator
 * Generates continuous gate telemetry at 15-second dynamic intervals (15,000 ms).
 * Persists records to MongoDB 3-Node Replica Set and publishes over MQTT.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const GateTelemetry = require('../backend/models/GateTelemetry');
const GateDevice = require('../backend/models/GateDevice');

const MONGO_URI = process.env.MONGO_URI || 
  'mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/iothings_gate?replicaSet=rs0&readPreference=primaryPreferred';
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const HOME_ID = process.env.HOME_ID || 'home_uk_01';
const GATE_ID = process.env.GATE_ID || 'gate_main_01';

// Sensor Telemetry Interval: 15 seconds (15,000 ms) default
const INTERVAL_MS = parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000;

let mqttClient = null;

function connectMQTT() {
  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `sensor_telemetry_generator_${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    console.log(`[MQTT] Connected to broker at ${MQTT_BROKER_URL}`);
  });

  mqttClient.on('error', (err) => {
    console.warn(`[MQTT] Broker warning: ${err.message}`);
  });
}

function calculateEnvironmentalMetrics(date = new Date()) {
  const hour = date.getHours();
  
  // Ambient motor temperature curve (peaking at 14:00, coolest at 04:00)
  const tempBase = 18.0 + 5.0 * Math.sin(((hour - 8) / 24) * 2 * Math.PI);
  const ambientMotorTemperatureC = parseFloat((tempBase + (Math.random() - 0.5) * 1.2).toFixed(1));

  // Diurnal sunlight lux curve (0 at night, up to 800 lux midday)
  let lux = 10;
  if (hour >= 6 && hour <= 19) {
    lux = Math.round(150 + 650 * Math.sin(((hour - 6) / 13) * Math.PI) + (Math.random() - 0.5) * 60);
  } else {
    lux = Math.round(10 + Math.random() * 15);
  }

  // Realistic driveway distance (240 - 280cm when clear)
  const isVehiclePassing = Math.random() < 0.04;
  const obstacleDistanceCm = isVehiclePassing 
    ? Math.round(35 + Math.random() * 40)
    : Math.round(250 + (Math.random() - 0.5) * 20);

  // PIR motion trigger
  const pirMotionDetected = isVehiclePassing || (Math.random() < 0.08);

  // Realistic gate state distribution across continuous sampling intervals:
  // ~80% IDLE_CLOSED (resting shut) -> FULLY_CLOSED
  // ~15% OPEN (resting open for car loading / resident arrival / delivery) -> FULLY_OPEN
  // ~5% OPENING / CLOSING (gate in active motion during sample interval) -> AJAR
  const rState = Math.random();
  let status = 'IDLE_CLOSED';
  let restingState = 'FULLY_CLOSED';
  let reedSwitchState = 'CLOSED';
  let motorCurrentAmps = 0.0;
  let lockEngaged = true;
  let standbyPowerWatts = parseFloat((1.9 + Math.random() * 0.4).toFixed(2)); // ~2.1W resting

  if (rState < 0.15) {
    status = 'OPEN';
    restingState = 'FULLY_OPEN';
    reedSwitchState = 'OPEN';
    motorCurrentAmps = 0.0;
    lockEngaged = false;
    standbyPowerWatts = parseFloat((2.2 + Math.random() * 0.3).toFixed(2)); // ~2.3W quiescent hold
  } else if (rState < 0.20) {
    status = Math.random() > 0.5 ? 'OPENING' : 'CLOSING';
    restingState = 'AJAR';
    reedSwitchState = 'AJAR';
    motorCurrentAmps = parseFloat((3.6 + Math.random() * 0.6).toFixed(2));
    lockEngaged = false;
    standbyPowerWatts = parseFloat((45.0 + Math.random() * 8.0).toFixed(1)); // ~48W moving
  } else {
    status = 'IDLE_CLOSED';
    restingState = 'FULLY_CLOSED';
    reedSwitchState = 'CLOSED';
    motorCurrentAmps = 0.0;
    lockEngaged = true;
    standbyPowerWatts = parseFloat((1.9 + Math.random() * 0.4).toFixed(2)); // ~2.1W resting
  }

  // 1. PHOTOCELL SENSOR METRICS
  const beamContinuity = obstacleDistanceCm >= 45;
  const lensDirtFactor = Math.random();
  let opticalSignalStrength = 96.0;
  let healthStatus = 'HEALTHY';

  if (!beamContinuity) {
    opticalSignalStrength = parseFloat((12.0 + Math.random() * 15.0).toFixed(1)); // Beam cut
    healthStatus = 'HEALTHY';
  } else if (lensDirtFactor < 0.05) {
    // Dirty lens / dust accumulation simulation
    opticalSignalStrength = parseFloat((58.0 + Math.random() * 14.0).toFixed(1));
    healthStatus = 'DIRTY_LENS_WARNING';
  } else if (lensDirtFactor < 0.08) {
    // Physical vibration misalignment
    opticalSignalStrength = parseFloat((44.0 + Math.random() * 10.0).toFixed(1));
    healthStatus = 'MISALIGNED';
  } else {
    // Optimal clean optical signal
    opticalSignalStrength = parseFloat((92.0 + Math.random() * 7.5).toFixed(1));
    opticalSignalStrength = Math.min(100.0, opticalSignalStrength);
    healthStatus = 'HEALTHY';
  }

  // 2. LIMIT SWITCH SENSOR METRICS (Configured with dynamic restingState & standbyPowerWatts)

  // 3. RFID READER SENSOR METRICS
  const noiseSpike = Math.random() < 0.06;
  const backgroundNoiseDbm = noiseSpike
    ? parseFloat((-62.0 + Math.random() * 5.0).toFixed(1)) // Temporary RF noise spike
    : parseFloat((-84.0 + (Math.random() - 0.5) * 4.0).toFixed(1)); // Clean floor ~ -84 dBm
  const antennaStatus = noiseSpike ? 'DETUNED' : 'OPTIMAL';
  const operationalHeartbeat = true;

  // 12V Backup battery float voltage
  const batteryBackupVoltage = parseFloat((12.75 + (Math.random() - 0.5) * 0.15).toFixed(2));
  const tamperVibrationG = parseFloat((0.02 + Math.random() * 0.015).toFixed(3));

  return {
    status,
    lockEngaged,
    photocell: {
      healthStatus,
      opticalSignalStrength,
      beamContinuity
    },
    limitSwitch: {
      restingState,
      ambientMotorTemperatureC,
      standbyPowerWatts
    },
    rfidReader: {
      operationalHeartbeat,
      antennaStatus,
      backgroundNoiseDbm
    },
    metrics: {
      obstacleDistanceCm,
      pirMotionDetected,
      reedSwitchState,
      motorCurrentAmps,
      motorTemperatureC: ambientMotorTemperatureC,
      batteryBackupVoltage,
      ambientLightLux: Math.max(5, lux),
      tamperVibrationG
    }
  };
}

async function generateAndPersistTelemetry(timestamp = new Date()) {
  const data = calculateEnvironmentalMetrics(timestamp);

  const doc = new GateTelemetry({
    homeId: HOME_ID,
    gateId: GATE_ID,
    status: data.status,
    lockEngaged: data.lockEngaged,
    photocell: data.photocell,
    limitSwitch: data.limitSwitch,
    rfidReader: data.rfidReader,
    metrics: data.metrics,
    timestamp: timestamp
  });

  const saved = await doc.save();

  // Also publish over MQTT to notify any active subscribers / web dashboard
  if (mqttClient && mqttClient.connected) {
    const topic = `iothings/home/${HOME_ID}/gate/telemetry`;
    const payload = JSON.stringify({
      gateId: GATE_ID,
      homeId: HOME_ID,
      status: data.status,
      lockEngaged: data.lockEngaged,
      photocell: data.photocell,
      limitSwitch: data.limitSwitch,
      rfidReader: data.rfidReader,
      metrics: data.metrics,
      timestamp: timestamp.toISOString()
    });
    mqttClient.publish(topic, payload, { qos: 0 });
  }

  // Update heartbeat on gate master controller device
  await GateDevice.updateOne(
    { deviceId: 'DEV-CTRL-01' },
    { $set: { lastHeartbeat: timestamp } }
  ).catch(() => {});

  const timeStr = timestamp.toLocaleTimeString();
  const dateStr = timestamp.toISOString().split('T')[0];
  const intervalSec = INTERVAL_MS / 1000;
  console.log(`[Sensor Telemetry ⏱ ${intervalSec}s] [${dateStr} ${timeStr}] Document ID: ${saved._id}`);
  console.log(`  ├─ 1. Photocell:   Signal=${data.photocell.opticalSignalStrength}% (${data.photocell.healthStatus}) | Beam=${data.photocell.beamContinuity ? 'CONTINUOUS' : 'BROKEN'}`);
  console.log(`  ├─ 2. Limit Switch: State=${data.limitSwitch.restingState} | Ambient Temp=${data.limitSwitch.ambientMotorTemperatureC}°C | Standby=${data.limitSwitch.standbyPowerWatts}W`);
  console.log(`  └─ 3. RFID Reader:  Heartbeat=${data.rfidReader.operationalHeartbeat ? 'OK' : 'FAIL'} | Antenna=${data.rfidReader.antennaStatus} | Noise Floor=${data.rfidReader.backgroundNoiseDbm} dBm`);

  return saved;
}

async function run() {
  console.log('===============================================================');
  console.log(' IoThings Continuous Sensor Data Generator');
  console.log(` Interval: ${INTERVAL_MS / 1000} seconds (${INTERVAL_MS} ms)`);
  console.log('===============================================================');

  // Connect to DB
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[DB] Connected to MongoDB 3-Node Replica Set.');
  } catch (err) {
    console.warn(`[DB] Replica set failed (${err.message}). Connecting to standalone fallback...`);
    await mongoose.connect('mongodb://127.0.0.1:27017/iothings_gate');
  }

  connectMQTT();

  // Check for command line flags: --backfill <days> or --once
  const args = process.argv.slice(2);
  const backfillIdx = args.indexOf('--backfill');

  if (backfillIdx !== -1 && args[backfillIdx + 1]) {
    const days = parseInt(args[backfillIdx + 1], 10) || 7;
    console.log(`[Backfill Mode] Generating continuous telemetry points for past ${days} days...`);
    const totalPoints = days * 24 * 12; // 12 points per hour
    const now = Date.now();
    const records = [];

    for (let i = totalPoints; i >= 0; i--) {
      const ptTime = new Date(now - i * (5 * 60 * 1000));
      const data = calculateEnvironmentalMetrics(ptTime);
      records.push({
        homeId: HOME_ID,
        gateId: GATE_ID,
        status: data.status,
        lockEngaged: data.lockEngaged,
        metrics: data.metrics,
        timestamp: ptTime
      });
    }

    await GateTelemetry.insertMany(records);
    console.log(`✓ Successfully backfilled ${records.length} continuous interval telemetry records!`);

    if (args.includes('--exit')) {
      await mongoose.disconnect();
      if (mqttClient) mqttClient.end();
      process.exit(0);
    }
  }

  // 1. Generate first telemetry point immediately on startup
  console.log('\nGenerating initial telemetry sample...');
  await generateAndPersistTelemetry(new Date());

  // 2. Schedule recurring generation every 15 seconds (15,000 ms)
  const nextIntervalMsg = INTERVAL_MS >= 60000 
    ? `${INTERVAL_MS / 60000} minutes` 
    : `${INTERVAL_MS / 1000} seconds`;
  console.log(`\nActive scheduler running: Next telemetry sample in ${nextIntervalMsg}.`);
  setInterval(async () => {
    try {
      await generateAndPersistTelemetry(new Date());
    } catch (err) {
      console.error('[Sensor Telemetry] Generation error:', err.message);
    }
  }, INTERVAL_MS);
}

run().catch(err => {
  console.error('Fatal generator error:', err);
  process.exit(1);
});
