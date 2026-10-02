const express = require('express');
const router = express.Router();
const GateEvent = require('../models/GateEvent');
const GateTelemetry = require('../models/GateTelemetry');
const mqttHandler = require('../mqtt/mqttHandler');
const { sendUnauthorizedAttemptNotification } = require('../services/emailService');
const { emitUnauthorizedSensorEvent } = require('../services/telemetryEmitter');

// GET /api/sensors/events
router.get('/events', async (req, res) => {
  try {
    const {
      homeId = 'home_uk_01',
      eventType,
      severity,
      limit = 50,
      skip = 0,
      startDate,
      endDate
    } = req.query;

    const query = { homeId };
    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const [events, total] = await Promise.all([
      GateEvent.find(query)
        .sort({ timestamp: -1 })
        .skip(parseInt(skip))
        .limit(Math.min(parseInt(limit), 200))
        .lean(),
      GateEvent.countDocuments(query)
    ]);

    res.json({
      success: true,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      data: events
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sensors/event - Ingest event directly or forward to MQTT
router.post('/event', async (req, res) => {
  try {
    const {
      eventId = `EVT-REST-${Date.now()}`,
      homeId = 'home_uk_01',
      gateId = 'gate_main_01',
      eventType,
      severity = 'INFO',
      sensorId = 'sensor_rest',
      source = 'REST_API',
      payload = {}
    } = req.body;

    if (!eventType) {
      return res.status(400).json({ success: false, error: 'eventType is required' });
    }

    const eventDoc = new GateEvent({
      eventId,
      homeId,
      gateId,
      eventType,
      severity,
      sensorId,
      source,
      payload,
      timestamp: new Date()
    });

    const saved = await eventDoc.save();

    res.status(201).json({
      success: true,
      message: 'Sensor event recorded successfully',
      data: saved
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sensors/telemetry - Stream recent telemetry points
router.get('/telemetry', async (req, res) => {
  try {
    const { gateId = 'gate_main_01', limit = 30 } = req.query;

    const telemetry = await GateTelemetry.find({ gateId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      count: telemetry.length,
      data: telemetry.reverse() // Chronological order
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sensors/unauthorized - Send unauthorized sensor data & dispatch security alert email
router.post('/unauthorized', async (req, res) => {
  try {
    const {
      type = 'RFID', // 'RFID', 'ALPR', 'PERSON', 'TAMPER'
      identifier,
      personName = 'Unauthorized Person / Intruder',
      reason,
      homeId = 'home_uk_01',
      gateId = 'gate_main_01'
    } = req.body;

    const result = await emitUnauthorizedSensorEvent({
      type,
      identifier,
      personName,
      reason,
      customDate: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Unauthorized sensor data recorded and security alert email dispatched to pg016742@gmail.com',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sensors/simulate - Trigger interactive simulation events from the UI
router.post('/simulate', async (req, res) => {
  try {
    const { action, homeId = 'home_uk_01', gateId = 'gate_main_01' } = req.body;

    let resultMsg = '';
    const now = new Date();

    switch (action) {
      case 'RESIDENT_RFID': {
        const payload = {
          eventId: `SIM-RFID-${Date.now()}`,
          gateId,
          eventType: 'RFID_SCAN',
          sensorId: 'sensor_rfid_pillar',
          payload: { tagId: 'RFID-8842-A' },
          timestamp: now.toISOString()
        };
        // Publish via MQTT to test full broker flow
        mqttHandler.publishCommand(homeId, gateId, 'OPEN', 'Resident RFID Scanned (Dr. Jane Davies)');
        resultMsg = 'Simulated resident RFID badge tap (Jane Davies). Gate opening triggered!';
        break;
      }

      case 'UNAUTHORIZED_RFID': {
        const result = await emitUnauthorizedSensorEvent({
          type: 'RFID',
          identifier: 'UNKNOWN-CLONE-99',
          personName: 'Unknown Intruder (Cloned Card)',
          reason: 'Unregistered RFID credential presented at gate pillar',
          customDate: now
        });
        resultMsg = `Simulated unauthorized RFID scan (UNKNOWN-CLONE-99). Gate LOCKED! Security alert email dispatched to pg016742@gmail.com!`;
        break;
      }

      case 'UNAUTHORIZED_ALPR': {
        const result = await emitUnauthorizedSensorEvent({
          type: 'ALPR',
          identifier: 'UNKNOWN-INTRUDER-99',
          personName: 'Unregistered Vehicle Driver',
          reason: 'Unregistered vehicle license plate detected at driveway ALPR',
          customDate: now
        });
        resultMsg = `Simulated unauthorized vehicle plate (UNKNOWN-INTRUDER-99). Gate LOCKED! Security alert email dispatched to pg016742@gmail.com!`;
        break;
      }

      case 'UNAUTHORIZED_PERSON': {
        const result = await emitUnauthorizedSensorEvent({
          type: 'PERSON',
          identifier: 'UNAUTHORIZED-PEDESTRIAN-01',
          personName: 'Unauthorized Pedestrian / Intruder',
          reason: 'Unauthorized person entered property perimeter while gate is locked',
          customDate: now
        });
        resultMsg = `Simulated unauthorized person entering perimeter! Gate LOCKED! Critical security alert email dispatched to pg016742@gmail.com!`;
        break;
      }

      case 'ALPR_VEHICLE': {
        mqttHandler.publishCommand(homeId, gateId, 'OPEN', 'Resident Vehicle Detected: BC24-UKS (Audi Q5)');
        resultMsg = 'Simulated resident vehicle arrival (Plate: BC24-UKS). Gate opening triggered!';
        break;
      }

      case 'SAFETY_OBSTACLE': {
        mqttHandler.publishCommand(homeId, gateId, 'SAFETY_REVERSE', 'Ultrasonic sensor triggered: Child/vehicle in path');
        const eventDoc = new GateEvent({
          eventId: `SIM-OBS-${Date.now()}`,
          homeId,
          gateId,
          eventType: 'SAFETY_OBSTACLE_DETECTED',
          severity: 'WARN',
          sensorId: 'sensor_ultrasonic_beam',
          source: 'AUTOMATED_SAFETY',
          payload: { distanceCm: 22, notes: 'Obstacle detected during closure - safety reverse executed' },
          timestamp: now
        });
        await eventDoc.save();
        resultMsg = 'Simulated safety obstacle in gate swing zone! Gate auto-reversed!';
        break;
      }

      case 'TAMPER_ALARM': {
        const result = await emitUnauthorizedSensorEvent({
          type: 'TAMPER',
          identifier: 'ENCLOSURE_SHOCK_3.8G',
          personName: 'Physical Intruder (Enclosure Tamper)',
          reason: 'High vibration (3.8G) detected on control housing - possible forced entry attempt!',
          customDate: now
        });
        resultMsg = 'Simulated anti-tamper alarm! Critical security alert email dispatched to pg016742@gmail.com!';
        break;
      }

      case 'GATE_HOLD_OPEN': {
        mqttHandler.publishCommand(homeId, gateId, 'HOLD_OPEN', 'Simulated Permanent Hold Open');
        resultMsg = 'Simulated HOLD OPEN! Gate held at FULLY_OPEN limit switch boundary (quiescent 2.3W standby).';
        break;
      }

      case 'GATE_OPEN_CYCLE': {
        mqttHandler.publishCommand(homeId, gateId, 'OPEN', 'Simulated Resident Arrival');
        resultMsg = 'Simulated Gate Open cycle! Gate transitioning to FULLY_OPEN, holding, then auto-closing to FULLY_CLOSED.';
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown simulation action' });
    }

    res.json({ success: true, message: resultMsg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sensors/generate-telemetry - Generate a continuous interval sensor data reading (FULLY_CLOSED or FULLY_OPEN)
router.post('/generate-telemetry', async (req, res) => {
  try {
    const { 
      homeId = 'home_uk_01', 
      gateId = 'gate_main_01',
      status: reqStatus,
      restingState: reqRestingState
    } = req.body;

    const now = new Date();
    const hour = now.getHours();

    const tempBase = 18.0 + 5.0 * Math.sin(((hour - 8) / 24) * 2 * Math.PI);
    const motorTemperatureC = parseFloat((tempBase + (Math.random() - 0.5) * 1.2).toFixed(1));

    let lux = 10;
    if (hour >= 6 && hour <= 19) {
      lux = Math.round(150 + 650 * Math.sin(((hour - 6) / 13) * Math.PI) + (Math.random() - 0.5) * 60);
    } else {
      lux = Math.round(10 + Math.random() * 15);
    }

    const currentState = mqttHandler.getGateState();
    
    // Determine effective gate state and limit switch boundary
    let effectiveStatus = reqStatus || (reqRestingState === 'FULLY_OPEN' ? 'OPEN' : (reqRestingState === 'FULLY_CLOSED' ? 'IDLE_CLOSED' : (currentState.status || 'IDLE_CLOSED')));
    let effectiveRestingState = reqRestingState || (effectiveStatus === 'OPEN' ? 'FULLY_OPEN' : (effectiveStatus === 'IDLE_CLOSED' || effectiveStatus === 'LOCKED' ? 'FULLY_CLOSED' : 'AJAR'));

    const isOpen = effectiveRestingState === 'FULLY_OPEN';
    const isClosed = effectiveRestingState === 'FULLY_CLOSED';
    const standbyPowerWatts = isClosed ? 2.1 : (isOpen ? 2.3 : 48.0);
    const reedSwitchState = isOpen ? 'OPEN' : (isClosed ? 'CLOSED' : 'AJAR');
    const motorCurrentAmps = (isOpen || isClosed) ? 0.0 : 3.8;
    const lockEngaged = isClosed;

    const obstacleDistanceCm = isOpen ? 280 : Math.round(250 + (Math.random() - 0.5) * 20);
    const batteryBackupVoltage = parseFloat((12.75 + (Math.random() - 0.5) * 0.15).toFixed(2));

    const photocell = {
      healthStatus: 'HEALTHY',
      opticalSignalStrength: 96.0,
      beamContinuity: true
    };

    const limitSwitch = {
      restingState: effectiveRestingState,
      ambientMotorTemperatureC: motorTemperatureC,
      standbyPowerWatts
    };

    const rfidReader = {
      operationalHeartbeat: true,
      antennaStatus: 'OPTIMAL',
      backgroundNoiseDbm: -82.5
    };

    const telemetryDoc = new GateTelemetry({
      homeId,
      gateId,
      status: effectiveStatus,
      lockEngaged,
      photocell,
      limitSwitch,
      rfidReader,
      metrics: {
        obstacleDistanceCm,
        pirMotionDetected: currentState.pirMotionDetected || Math.random() < 0.05,
        reedSwitchState,
        motorCurrentAmps,
        motorTemperatureC,
        batteryBackupVoltage,
        ambientLightLux: Math.max(5, lux),
        tamperVibrationG: 0.02
      },
      timestamp: now
    });

    const saved = await telemetryDoc.save();

    // Broadcast over MQTT to telemetry topic
    mqttHandler.publishTelemetry(homeId, {
      gateId,
      homeId,
      status: effectiveStatus,
      lockEngaged,
      photocell,
      limitSwitch,
      rfidReader,
      metrics: telemetryDoc.metrics,
      timestamp: now.toISOString()
    });

    const curIntervalMs = parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000;
    const intervalLabel = curIntervalMs >= 60000 
      ? `${curIntervalMs / 60000} minutes (${curIntervalMs.toLocaleString()} ms)`
      : `${curIntervalMs / 1000} seconds (${curIntervalMs.toLocaleString()} ms)`;

    res.status(201).json({
      success: true,
      interval: intervalLabel,
      restingState: effectiveRestingState,
      gateStatus: effectiveStatus,
      message: `Continuous sensor telemetry point (${effectiveRestingState}) persisted to MongoDB and dispatched to MQTT`,
      data: saved
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
