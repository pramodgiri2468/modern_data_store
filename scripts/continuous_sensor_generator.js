#!/usr/bin/env node
/**
 * IoThings Continuous Sensor Data Generator
 * Generates continuous gate telemetry at 5-minute intervals (300,000 ms).
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
    clientId: `sensor_5min_generator_${Math.random().toString(16).slice(2, 8)}`,
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

  // Motor state (usually IDLE_CLOSED when at 5-minute sampling points)
  const isOperating = Math.random() < 0.03;
  const status = isOperating ? 'OPENING' : 'IDLE_CLOSED';
  const reedSwitchState = isOperating ? 'AJAR' : 'CLOSED';
  const motorCurrentAmps = isOperating ? parseFloat((3.6 + Math.random() * 0.6).toFixed(2)) : 0.0;
  const lockEngaged = !isOperating;

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

  // 2. LIMIT SWITCH SENSOR METRICS
  const restingState = (status === 'IDLE_CLOSED' || status === 'LOCKED') 
    ? 'FULLY_CLOSED' 
    : (status === 'OPEN' ? 'FULLY_OPEN' : 'AJAR');
  const standbyPowerWatts = (restingState === 'FULLY_CLOSED') 
    ? parseFloat((1.9 + Math.random() * 0.4).toFixed(2)) // 1.9W - 2.3W in resting standby
    : parseFloat((45.0 + Math.random() * 8.0).toFixed(1)); // 45W - 53W while moving

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
  console.log(`[5-Min Telemetry] [${dateStr} ${timeStr}] Document ID: ${saved._id}`);
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
    console.log(`[Backfill Mode] Generating continuous 5-minute intervals for past ${days} days...`);
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
    console.log(`✓ Successfully backfilled ${records.length} continuous 5-minute interval telemetry records!`);

    if (args.includes('--exit')) {
      await mongoose.disconnect();
      if (mqttClient) mqttClient.end();
      process.exit(0);
    }
  }

  // 1. Generate first 5-minute telemetry point immediately on startup
  console.log('\nGenerating initial 5-minute interval telemetry sample...');
  await generateAndPersistTelemetry(new Date());

  // 2. Schedule recurring generation every 5 minutes (300,000 ms)
  console.log(`\nActive scheduler running: Next telemetry sample in ${INTERVAL_MS / 60000} minutes.`);
  setInterval(async () => {
    try {
      await generateAndPersistTelemetry(new Date());
    } catch (err) {
      console.error('[5-Min Telemetry] Generation error:', err.message);
    }
  }, INTERVAL_MS);
}

run().catch(err => {
  console.error('Fatal generator error:', err);
  process.exit(1);
});
