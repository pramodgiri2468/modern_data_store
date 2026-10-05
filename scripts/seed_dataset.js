const mongoose = require('mongoose');
const GateEvent = require('../backend/models/GateEvent');
const GateTelemetry = require('../backend/models/GateTelemetry');
const AccessPolicy = require('../backend/models/AccessPolicy');
const GateDevice = require('../backend/models/GateDevice');

const MONGO_URI = process.env.MONGO_URI || 
  'mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/iothings_gate?replicaSet=rs0&readPreference=primaryPreferred';

async function seedDatabase() {
  console.log('[seed] Connecting to database...');

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.warn(`[seed] Cluster connection failed (${err.message}); falling back to standalone...`);
    await mongoose.connect('mongodb://127.0.0.1:27017/iothings_gate');
  }

  console.log('[seed] Clearing existing collections...');
  await Promise.all([
    GateEvent.deleteMany({}),
    GateTelemetry.deleteMany({}),
    AccessPolicy.deleteMany({}),
    GateDevice.deleteMany({})
  ]);

  // 1. Hardware Devices
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
  console.log(`[seed] Inserted ${devices.length} gate devices`);

  // 2. Access Control Policies
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
  console.log(`[seed] Inserted ${policies.length} access policies`);

  // 3. Historical Gate Events (30 Days)
  const events = [];
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (let day = 30; day >= 0; day--) {
    const dayStart = now - day * DAY_MS;
    const cyclesCount = 45 + Math.floor(Math.random() * 25);

    for (let c = 0; c < cyclesCount; c++) {
      let hour;
      const r = Math.random();
      if (r < 0.35) {
        hour = 7 + Math.floor(Math.random() * 3);
      } else if (r < 0.65) {
        hour = 17 + Math.floor(Math.random() * 4);
      } else if (r < 0.85) {
        hour = 12 + Math.floor(Math.random() * 3);
      } else {
        hour = Math.floor(Math.random() * 24);
      }

      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      const eventTime = new Date(dayStart);
      eventTime.setHours(hour, minute, second);

      const typeRand = Math.random();
      if (typeRand < 0.45) {
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
  console.log(`[seed] Inserted ${events.length} historical events`);

  // 4. Historical Telemetry (Past 14 Days, 5-minute sampling)
  const telemetryPoints = [];
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const total5MinPoints = 14 * 24 * 12;

  for (let i = total5MinPoints; i >= 0; i--) {
    const time = new Date(now - i * FIVE_MIN_MS);
    const hour = time.getHours();

    const tempBase = 18.0 + 5.0 * Math.sin(((hour - 8) / 24) * 2 * Math.PI);
    const motorTemperatureC = parseFloat((tempBase + (Math.random() - 0.5) * 1.2).toFixed(1));

    let ambientLightLux = 10;
    if (hour >= 6 && hour <= 19) {
      ambientLightLux = Math.round(150 + 650 * Math.sin(((hour - 6) / 13) * Math.PI) + (Math.random() - 0.5) * 60);
    } else {
      ambientLightLux = Math.round(10 + Math.random() * 15);
    }

    let telemStatus = 'IDLE_CLOSED';
    let restingState = 'FULLY_CLOSED';
    let reedSwitchState = 'CLOSED';
    let motorCurrentAmps = 0.0;
    let standbyPowerWatts = parseFloat((2.1 + (Math.random() - 0.5) * 0.3).toFixed(2));
    let lockEngaged = true;

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
  console.log(`[seed] Inserted ${telemetryPoints.length} telemetry records`);

  console.log('[seed] Seeding completed successfully');
  await mongoose.disconnect();
}

seedDatabase().catch((err) => {
  console.error('[seed] Seeding failed:', err);
  process.exit(1);
});
