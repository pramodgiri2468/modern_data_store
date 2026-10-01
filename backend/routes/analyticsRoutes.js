const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

// GET /api/analytics/hourly-traffic
router.get('/hourly-traffic', async (req, res) => {
  try {
    const { homeId = 'home_uk_01', days = 30 } = req.query;
    const data = await analyticsService.getHourlyTraffic(homeId, parseInt(days));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/security
router.get('/security', async (req, res) => {
  try {
    const { homeId = 'home_uk_01', days = 30 } = req.query;
    const data = await analyticsService.getSecurityAnalytics(homeId, parseInt(days));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/motor-health
router.get('/motor-health', async (req, res) => {
  try {
    const { gateId = 'gate_main_01' } = req.query;
    const data = await analyticsService.getMotorHealth(gateId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/summary
router.get('/summary', async (req, res) => {
  try {
    const { homeId = 'home_uk_01' } = req.query;
    const data = await analyticsService.getDashboardSummary(homeId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/sensor-health - Diagnostics for Photocell, Limit Switch, and RFID Reader
router.get('/sensor-health', async (req, res) => {
  try {
    const { gateId = 'gate_main_01' } = req.query;
    const data = await analyticsService.getSensorHealthAnalytics(gateId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
