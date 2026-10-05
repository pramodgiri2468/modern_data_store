const express = require('express');
const router = express.Router();
const mqttHandler = require('../mqtt/mqttHandler');
const GateEvent = require('../models/GateEvent');

const VALID_ACTIONS = ['OPEN', 'CLOSE', 'LOCK', 'UNLOCK', 'STOP', 'HOLD_OPEN', 'SAFETY_REVERSE'];

router.post('/command', async (req, res) => {
  try {
    const { action, homeId = 'home_uk_01', gateId = 'gate_main_01', reason = 'Manual API Trigger' } = req.body;

    if (!action || !VALID_ACTIONS.includes(action.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Supported: ${VALID_ACTIONS.join(', ')}`
      });
    }

    const command = action.toUpperCase();
    const published = mqttHandler.publishCommand(homeId, gateId, command, reason);

    if (['OPEN', 'CLOSE', 'LOCK', 'UNLOCK', 'STOP', 'HOLD_OPEN'].includes(command)) {
      let eventType = 'MANUAL_REMOTE_OPEN';
      if (command === 'CLOSE') eventType = 'MANUAL_REMOTE_CLOSE';
      else if (command === 'LOCK') eventType = 'LOCK_ENGAGED';
      else if (command === 'UNLOCK') eventType = 'LOCK_RELEASED';

      const eventDoc = new GateEvent({
        eventId: `CMD-EVT-${Date.now()}`,
        homeId,
        gateId,
        eventType,
        severity: 'INFO',
        sensorId: 'api_gateway',
        source: 'REST_API',
        payload: { command, reason, requester: req.ip },
        timestamp: new Date()
      });
      await eventDoc.save();
    }

    res.json({
      success: true,
      message: `Command '${command}' dispatched to gate controller`,
      action: command,
      mqttPublished: published
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/status', (req, res) => {
  const state = mqttHandler.getGateState();
  res.json({
    success: true,
    data: state
  });
});

module.exports = router;
