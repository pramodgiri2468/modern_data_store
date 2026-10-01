const express = require('express');
const router = express.Router();
const {
  getRecentNotifications,
  sendAuthorizedEntryNotification,
  sendUnauthorizedAttemptNotification
} = require('../services/emailService');

// GET /api/notifications - List recent email notifications dispatched
router.get('/', (req, res) => {
  try {
    const list = getRecentNotifications();
    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/test - Trigger an authorized test email dispatch
router.post('/test', async (req, res) => {
  try {
    const { email, holderName = 'Pramod (Resident)', userRole = 'RESIDENT' } = req.body;
    const targetEmail = email || process.env.DEFAULT_ALERT_EMAIL || 'pg016742@gmail.com';

    const testPolicy = {
      holderName,
      userRole,
      credentialType: 'RFID_TAG',
      identifier: 'RFID-TEST-999',
      notificationEmail: targetEmail
    };

    const record = await sendAuthorizedEntryNotification({
      policy: testPolicy,
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      credentialType: 'RFID_TAG',
      identifier: 'RFID-TEST-999',
      method: 'MANUAL_TEST_TRIGGER',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: `Authorized test email notification dispatched to: ${targetEmail}`,
      data: record
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/test-unauthorized - Trigger an unauthorized security alert email test
router.post('/test-unauthorized', async (req, res) => {
  try {
    const {
      email,
      identifier = 'UNKNOWN-INTRUDER-99',
      credentialType = 'RFID_TAG',
      reason = 'Unregistered intruder RFID card detected at gate pillar'
    } = req.body;
    const targetEmail = email || process.env.DEFAULT_ALERT_EMAIL || 'pg016742@gmail.com';

    const record = await sendUnauthorizedAttemptNotification({
      homeId: 'home_uk_01',
      gateId: 'gate_main_01',
      credentialType,
      identifier,
      method: 'TEST_INTRUSION_SIMULATION',
      reason,
      recipient: targetEmail,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: `Unauthorized security alert email dispatched to: ${targetEmail}`,
      data: record
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
