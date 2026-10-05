const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

router.get('/hourly-traffic', async (req, res) => {
  try {
    const { homeId = 'home_uk_01', days = 30 } = req.query;
    const data = await analyticsService.getHourlyTraffic(homeId, parseInt(days, 10));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/security', async (req, res) => {
  try {
    const { homeId = 'home_uk_01', days = 30 } = req.query;
    const data = await analyticsService.getSecurityAnalytics(homeId, parseInt(days, 10));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/motor-health', async (req, res) => {
  try {
    const { gateId = 'gate_main_01' } = req.query;
    const data = await analyticsService.getMotorHealth(gateId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { homeId = 'home_uk_01' } = req.query;
    const data = await analyticsService.getDashboardSummary(homeId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
