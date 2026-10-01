const express = require('express');
const router = express.Router();
const database = require('../config/database');

// GET /api/cluster/status
router.get('/status', async (req, res) => {
  try {
    const clusterInfo = await database.getClusterStatus();
    res.json({
      success: true,
      data: clusterInfo
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
