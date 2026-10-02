const mongoose = require('mongoose');
const GateEvent = require('../backend/models/GateEvent');
const GateTelemetry = require('../backend/models/GateTelemetry');
const AccessPolicy = require('../backend/models/AccessPolicy');
const GateDevice = require('../backend/models/GateDevice');

const MONGO_URI = process.env.MONGO_URI || 
  'mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/iothings_gate?replicaSet=rs0&readPreference=primaryPreferred';

async function seedDatabase() {
  console.log('========================================================');
  console.log(' IoThings UK GDPR-Compliant Synthetic Dataset Generator');
  console.log(' Connecting to MongoDB Replica Set...');
  console.log('========================================================');

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
  } catch (err) {
    console.warn(`Replica set connection failed (${err.message}). Connecting to standalone...`);
    await mongoose.connect('mongodb://127.0.0.1:27017/iothings_gate');
  }

  console.log('Connected! Purging old demo records...');
  await Promise.all([
    GateEvent.deleteMany({}),
    GateTelemetry.deleteMany({}),
    AccessPolicy.deleteMany({}),
    GateDevice.deleteMany({})
  ]);

  // 1. Seed IoT Hardware Devices
  console.log('Seeding Gate Hardware Devices...');
  const devices = [
    {
      deviceId: 'DEV-CTRL-01',
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      name: 'IoThings Master Gate Hub & Motor Controller',
      deviceType: 'GATE_CONTROLLER_MASTER',
      firmwareVersion: 'v2.4.1',
      macAddress: 'B8:27:EB:4A:89:12',
      ipAddress: '192.168.1.101',
      status: 'ONLINE',
      totalCyclesOperated: 1420
    },
    {
      deviceId: 'DEV-BEAM-01',
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      name: 'Dual Ultrasonic & IR Safety Obstacle Beam',
      deviceType: 'ULTRASONIC_SAFETY_BEAM',
      firmwareVersion: 'v1.8.0',
      macAddress: 'B8:27:EB:11:55:AA',
      ipAddress: '192.168.1.102',
      status: 'ONLINE',
      totalCyclesOperated: 1420
    },
    {
      deviceId: 'DEV-PIR-01',
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      name: 'Driveway Perimeter PIR Motion Sensor',
      deviceType: 'PIR_MOTION_DETECTOR',
      firmwareVersion: 'v1.2.3',
      macAddress: 'B8:27:EB:22:66:BB',
      ipAddress: '192.168.1.103',
      status: 'ONLINE',
      totalCyclesOperated: 3200
    },
    {
      deviceId: 'DEV-RFID-01',
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      name: 'Pillar Contactless RFID/NFC Intercom Reader',
      deviceType: 'RFID_CARD_READER',
      firmwareVersion: 'v3.0.1',
      macAddress: 'B8:27:EB:33:77:CC',
      ipAddress: '192.168.1.104',
      status: 'ONLINE',
      totalCyclesOperated: 980
    },
    {
      deviceId: 'DEV-ALPR-01',
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      name: 'Edge AI High-Definition ALPR Camera Unit',
      deviceType: 'ALPR_CAMERA_NODE',
      firmwareVersion: 'v4.1.0',
      macAddress: 'B8:27:EB:44:88:DD',
      ipAddress: '192.168.1.105',
      status: 'ONLINE',
      totalCyclesOperated: 760
    },
    {
      deviceId: 'DEV-LOCK-01',
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      name: 'High-Torque Solenoid Smart Deadbolt',
      deviceType: 'SOLENOID_SMART_LOCK',
      firmwareVersion: 'v1.0.5',
      macAddress: 'B8:27:EB:55:99:EE',
      ipAddress: '192.168.1.106',
      status: 'ONLINE',
      totalCyclesOperated: 1420
    },
    {
      deviceId: 'DEV-TMP-01',
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      name: 'Housing Anti-Tamper & Vibration Accelerometer',
      deviceType: 'TAMPER_ACCELEROMETER',
      firmwareVersion: 'v1.1.2',
      macAddress: 'B8:27:EB:66:AA:FF',
      ipAddress: '192.168.1.107',
      status: 'ONLINE',
      totalCyclesOperated: 1420
    }
  ];
  await GateDevice.insertMany(devices);
  console.log(`✓ Inserted ${devices.length} Gate Devices.`);

  // 2. Seed Access Control Policies
  console.log('Seeding Access Control Policies...');
  const policies = [
    {
      policyId: 'POL-001',
      homeId: 'home_uk_01',
      credentialType: 'RFID_TAG',
      identifier: 'RFID-8842-A',
      holderName: 'Pramod (Resident)',
      userRole: 'RESIDENT',
      notificationEmail: 'pg016742@gmail.com',
      schedule: { is24x7: true, allowedDays: [0, 1, 2, 3, 4, 5, 6], timeStart: '00:00', timeEnd: '23:59' },
      isActive: true,
      notes: 'Master Homeowner Tag'
    },
    {
      policyId: 'POL-002',
      homeId: 'home_uk_01',
      credentialType: 'RFID_TAG',
      identifier: 'RFID-1029-C',
      holderName: 'Mark Davies',
      userRole: 'RESIDENT',
      notificationEmail: 'pg016742@gmail.com',
      schedule: { is24x7: true, allowedDays: [0, 1, 2, 3, 4, 5, 6], timeStart: '00:00', timeEnd: '23:59' },
      isActive: true,
      notes: 'Resident Family Keyfob'
    },
    {
      policyId: 'POL-003',
      homeId: 'home_uk_01',
      credentialType: 'LICENSE_PLATE',
      identifier: 'BC24-UKS',
      holderName: 'Pramod Vehicle (Audi Q5)',
      userRole: 'RESIDENT',
      notificationEmail: 'pg016742@gmail.com',
      schedule: { is24x7: true, allowedDays: [0, 1, 2, 3, 4, 5, 6], timeStart: '00:00', timeEnd: '23:59' },
      isActive: true,
      notes: 'Registered Resident Vehicle'
    },
    {
      policyId: 'POL-004',
      homeId: 'home_uk_01',
      credentialType: 'LICENSE_PLATE',
      identifier: 'DPD-998-UK',
      holderName: 'DPD Express Delivery',
      userRole: 'DELIVERY',
      notificationEmail: 'courier-logistics@dpd.co.uk',
      schedule: { is24x7: false, allowedDays: [1, 2, 3, 4, 5], timeStart: '08:00', timeEnd: '18:00' },
      isActive: true,
      notes: 'Delivery Courier Daytime Window'
    },
    {
      policyId: 'POL-005',
      homeId: 'home_uk_01',
      credentialType: 'RFID_TAG',
      identifier: 'RFID-7711-G',
      holderName: 'Garden & Grounds Maintenance',
      userRole: 'STAFF',
      notificationEmail: 'maintenance@greenscape-uk.com',
      schedule: { is24x7: false, allowedDays: [2, 4], timeStart: '09:00', timeEnd: '16:00' },
      isActive: true,
      notes: 'Bi-weekly groundskeeper access'
    },
    {
      policyId: 'POL-006',
      homeId: 'home_uk_01',
      credentialType: 'PIN_CODE',
      identifier: 'PIN-9418',
      holderName: 'Guest Temporary Pin',
      userRole: 'GUEST',
      notificationEmail: 'guest-access@iothings.co.uk',
      schedule: { is24x7: false, allowedDays: [0, 6], timeStart: '10:00', timeEnd: '22:00' },
      isActive: true,
      notes: 'Weekend visitor access code'
    }
  ];
  await AccessPolicy.insertMany(policies);
  console.log(`✓ Inserted ${policies.length} Access Policies.`);

  // 3. Seed Realistic Historical Events (30 Days)
  console.log('Generating 30 days of realistic sensor activation events (~2,500 records)...');
  const events = [];
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (let day = 30; day >= 0; day--) {
    const dayStart = now - day * DAY_MS;

    // Simulate high-density daily activations: morning commutes, afternoon deliveries, evening returns
    const cyclesCount = 45 + Math.floor(Math.random() * 25); // 45-70 events per day (~1,800-2,500 total)

    for (let c = 0; c < cyclesCount; c++) {
      // Pick realistic hour: 7-9am (morning), 12-14pm (delivery), 17-20pm (evening), or random
      let hour;
      const r = Math.random();
      if (r < 0.35) {
        hour = 7 + Math.floor(Math.random() * 3); // 7, 8, 9
      } else if (r < 0.65) {
        hour = 17 + Math.floor(Math.random() * 4); // 17, 18, 19, 20
      } else if (r < 0.85) {
        hour = 12 + Math.floor(Math.random() * 3); // 12, 13, 14
      } else {
        hour = Math.floor(Math.random() * 24);
      }

      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      const eventTime = new Date(dayStart);
      eventTime.setHours(hour, minute, second);

      // Event Type Distribution
      const typeRand = Math.random();
      if (typeRand < 0.45) {
        // Resident RFID
        events.push({
          eventId: `EVT-${eventTime.getTime()}-${Math.floor(Math.random()*1000)}`,
          homeId: 'home_uk_01',
          gateId: 'gate_main_01',
          eventType: 'RFID_ENTRY_SUCCESS',
          severity: 'INFO',
          sensorId: 'DEV-RFID-01',
          source: 'MQTT_TELEMETRY',
          payload: { tagId: 'RFID-8842-A', holderName: 'Dr. Jane Davies', userRole: 'RESIDENT' },
          timestamp: eventTime
        });
      } else if (typeRand < 0.75) {
        // ALPR Vehicle
        events.push({
          eventId: `EVT-${eventTime.getTime()}-${Math.floor(Math.random()*1000)}`,
          homeId: 'home_uk_01',
          gateId: 'gate_main_01',
          eventType: 'ALPR_ENTRY_SUCCESS',
          severity: 'INFO',
          sensorId: 'DEV-ALPR-01',
          source: 'MQTT_TELEMETRY',
          payload: { plateNumber: 'BC24-UKS', holderName: 'Jane Davies (Audi Q5)', userRole: 'RESIDENT' },
          timestamp: eventTime
        });
      } else if (typeRand < 0.88) {
        // Manual remote open from mobile app
        events.push({
          eventId: `EVT-${eventTime.getTime()}-${Math.floor(Math.random()*1000)}`,
          homeId: 'home_uk_01',
          gateId: 'gate_main_01',
          eventType: 'MANUAL_REMOTE_OPEN',
          severity: 'INFO',
          sensorId: 'api_gateway',
          source: 'REST_API',
          payload: { command: 'OPEN', reason: 'Mobile App Quick Access', requester: '192.168.1.55' },
          timestamp: eventTime
        });
      } else if (typeRand < 0.94) {
        // Safety obstacle detected (auto-reverse)
        events.push({
          eventId: `EVT-${eventTime.getTime()}-${Math.floor(Math.random()*1000)}`,
          homeId: 'home_uk_01',
          gateId: 'gate_main_01',
          eventType: 'SAFETY_OBSTACLE_DETECTED',
          severity: 'WARN',
          sensorId: 'DEV-BEAM-01',
          source: 'AUTOMATED_SAFETY',
          payload: { distanceCm: 28, notes: 'Obstacle detected during closure - safety reverse triggered' },
          timestamp: eventTime
        });
      } else if (typeRand < 0.98) {
        // Unauthorized RFID attempt
        events.push({
          eventId: `EVT-${eventTime.getTime()}-${Math.floor(Math.random()*1000)}`,
          homeId: 'home_uk_01',
          gateId: 'gate_main_01',
          eventType: 'RFID_ENTRY_DENIED',
          severity: 'WARN',
          sensorId: 'DEV-RFID-01',
          source: 'MQTT_TELEMETRY',
          payload: { tagId: `UNKNOWN-TAG-${Math.floor(Math.random()*9000)+1000}`, failureReason: 'Unregistered credential' },
          timestamp: eventTime
        });
      } else {
        // Tamper alarm test or overcurrent
        events.push({
          eventId: `EVT-${eventTime.getTime()}-${Math.floor(Math.random()*1000)}`,
          homeId: 'home_uk_01',
          gateId: 'gate_main_01',
          eventType: Math.random() > 0.5 ? 'TAMPER_ALARM' : 'MOTOR_OVERCURRENT_WARNING',
          severity: 'CRITICAL',
          sensorId: 'DEV-TMP-01',
          source: 'MQTT_TELEMETRY',
          payload: { vibrationG: 3.4, notes: 'Abnormal mechanical shock or enclosure vibration' },
          timestamp: eventTime
        });
      }
    }
  }

  await GateEvent.insertMany(events);
  console.log(`✓ Inserted ${events.length} Historical Gate Events.`);

  // 4. Seed Continuous Telemetry Data Points at Exact 5-Minute Intervals
  console.log('Generating continuous time-series telemetry at exact 5-minute intervals (past 14 days, ~4,032 points)...');
  const telemetryPoints = [];
  const FIVE_MIN_MS = 5 * 60 * 1000; // 300,000 ms
  const total5MinPoints = 14 * 24 * 12; // 14 days * 24 hrs * 12 points/hr = 4,032 points

  for (let i = total5MinPoints; i >= 0; i--) {
    const time = new Date(now - i * FIVE_MIN_MS);
    const hour = time.getHours();

    // Diurnal variation for temperature and light matching real-world 5-minute sensor intervals
    const tempBase = 18.0 + 5.0 * Math.sin(((hour - 8) / 24) * 2 * Math.PI);
    const motorTemperatureC = parseFloat((tempBase + (Math.random() - 0.5) * 1.2).toFixed(1));

    let ambientLightLux = 10;
    if (hour >= 6 && hour <= 19) {
      ambientLightLux = Math.round(150 + 650 * Math.sin(((hour - 6) / 13) * Math.PI) + (Math.random() - 0.5) * 60);
    } else {
      ambientLightLux = Math.round(10 + Math.random() * 15);
    }

    // Historical 5-minute sampling distribution across 14 days (4,032 points):
    // ~85% FULLY_CLOSED (resting locked shut)
    // ~12% FULLY_OPEN (driveway access, resident car departure/arrival, deliveries)
    // ~3% AJAR (opening or closing transit)
    let telemStatus = 'IDLE_CLOSED';
    let restingState = 'FULLY_CLOSED';
    let reedSwitchState = 'CLOSED';
    let motorCurrentAmps = 0.0;
    let standbyPowerWatts = parseFloat((2.1 + (Math.random() - 0.5) * 0.3).toFixed(2));
    let lockEngaged = true;

    // Simulate daytime openings (between 7am and 21pm)
    const isDay = hour >= 7 && hour <= 21;
    if (isDay && (i % 22 === 0 || i % 23 === 0)) {
      telemStatus = 'OPEN';
      restingState = 'FULLY_OPEN';
      reedSwitchState = 'OPEN';
      motorCurrentAmps = 0.0;
      standbyPowerWatts = parseFloat((2.3 + (Math.random() - 0.5) * 0.2).toFixed(2));
      lockEngaged = false;
    } else if (i % 72 < 2) {
      telemStatus = (i % 72 === 0) ? 'OPENING' : 'CLOSING';
      restingState = 'AJAR';
      reedSwitchState = 'AJAR';
      motorCurrentAmps = parseFloat((3.8 + Math.random() * 0.6).toFixed(2));
      standbyPowerWatts = parseFloat((46.0 + Math.random() * 6.0).toFixed(1));
      lockEngaged = false;
    }

    const isMoving = (restingState === 'AJAR');
    const beamContinuity = !isMoving && Math.random() > 0.01;

    // 1. Photocell metrics
    let opticalSignalStrength = 95.0;
    let photocellHealth = 'HEALTHY';
    if (!beamContinuity) {
      opticalSignalStrength = parseFloat((12.0 + Math.random() * 12.0).toFixed(1));
      photocellHealth = 'HEALTHY';
    } else if (i % 200 === 0) {
      opticalSignalStrength = parseFloat((56.0 + Math.random() * 10.0).toFixed(1));
      photocellHealth = 'DIRTY_LENS_WARNING';
    } else {
      opticalSignalStrength = parseFloat((92.0 + Math.random() * 7.5).toFixed(1));
      opticalSignalStrength = Math.min(100.0, opticalSignalStrength);
      photocellHealth = 'HEALTHY';
    }

    // 2. Limit Switch metrics (computed above in restingState & standbyPowerWatts)

    // 3. RFID Reader metrics
    const noiseSpike = (i % 150 === 0);
    const backgroundNoiseDbm = noiseSpike 
      ? parseFloat((-61.0 + Math.random() * 4.0).toFixed(1)) 
      : parseFloat((-83.5 + (Math.random() - 0.5) * 3.0).toFixed(1));
    const antennaStatus = noiseSpike ? 'DETUNED' : 'OPTIMAL';

    telemetryPoints.push({
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      status: telemStatus,
      photocell: {
        healthStatus: photocellHealth,
        opticalSignalStrength,
        beamContinuity
      },
      limitSwitch: {
        restingState,
        ambientMotorTemperatureC: motorTemperatureC,
        standbyPowerWatts
      },
      rfidReader: {
        operationalHeartbeat: true,
        antennaStatus,
        backgroundNoiseDbm
      },
      metrics: {
        obstacleDistanceCm: isMoving ? Math.round(45 + Math.random() * 30) : Math.round(250 + (Math.random() - 0.5) * 20),
        pirMotionDetected: isMoving || Math.random() < 0.06,
        reedSwitchState,
        motorCurrentAmps,
        motorTemperatureC,
        batteryBackupVoltage: parseFloat((12.75 + (Math.random() - 0.5) * 0.15).toFixed(2)),
        ambientLightLux: Math.max(5, ambientLightLux),
        tamperVibrationG: 0.02
      },
      lockEngaged,
      timestamp: time
    });
  }

  await GateTelemetry.insertMany(telemetryPoints);
  console.log(`✓ Inserted ${telemetryPoints.length} Continuous 5-Minute Telemetry Records (14-day continuous series).`);

  console.log('========================================================');
  console.log(' Synthetic Dataset Seeding Complete!');
  console.log(' Database populated for distributed queries, CRUD, & reporting.');
  console.log('========================================================');

  await mongoose.disconnect();
}

seedDatabase().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
