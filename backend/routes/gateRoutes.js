const express = require('express');
const router = express.Router();
const mqttHandler = require('../mqtt/mqttHandler');
const GateEvent = require('../models/GateEvent');

// POST /api/gate/command
router.post('/command', async (req, res) => {
  try {
    const { action, homeId = 'home_uk_01', gateId = 'gate_main_01', reason = 'Manual API Trigger' } = req.body;

    const validActions = ['OPEN', 'CLOSE', 'LOCK', 'UNLOCK', 'STOP', 'HOLD_OPEN', 'SAFETY_REVERSE'];
    if (!action || !validActions.includes(action.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Supported actions: ${validActions.join(', ')}`
      });
    }

    const upperAction = action.toUpperCase();
    const published = mqttHandler.publishCommand(homeId, gateId, upperAction, reason);

    // Also record event for manual operations
    if (['OPEN', 'CLOSE', 'LOCK', 'UNLOCK', 'STOP', 'HOLD_OPEN'].includes(upperAction)) {
      const eventDoc = new GateEvent({
        eventId: `CMD-EVT-${Date.now()}`,
        homeId,
        gateId,
        eventType: upperAction === 'OPEN' ? 'MANUAL_REMOTE_OPEN' : upperAction === 'CLOSE' ? 'MANUAL_REMOTE_CLOSE' : upperAction === 'LOCK' ? 'LOCK_ENGAGED' : 'LOCK_RELEASED',
        severity: 'INFO',
        sensorId: 'api_gateway',
        source: 'REST_API',
        payload: { command: upperAction, reason, requester: req.ip },
        timestamp: new Date()
      });
      await eventDoc.save();
    }

    res.json({
      success: true,
      message: `Command '${upperAction}' published via MQTT topic iothings/home/${homeId}/gate/commands`,
      action: upperAction,
      mqttPublished: published
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/gate/status
router.get('/status', (req, res) => {
  const state = mqttHandler.getGateState();
  res.json({
    success: true,
    data: state
  });
});

module.exports = router;
