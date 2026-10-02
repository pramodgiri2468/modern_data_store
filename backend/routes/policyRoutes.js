const express = require('express');
const router = express.Router();
const AccessPolicy = require('../models/AccessPolicy');
const { sendAuthorizedEntryNotification, sendUnauthorizedAttemptNotification } = require('../services/emailService');

// 1. CREATE - POST /api/policies
router.post('/', async (req, res) => {
  try {
    const {
      policyId = `POL-${Date.now().toString(36).toUpperCase()}`,
      homeId = 'home_uk_01',
      credentialType,
      identifier,
      holderName,
      userRole = 'RESIDENT',
      notificationEmail = '',
      schedule = {},
      isActive = true,
      validUntil = null,
      notes = ''
    } = req.body;

    if (!credentialType || !identifier || !holderName) {
      return res.status(400).json({
        success: false,
        error: 'credentialType, identifier, and holderName are required fields'
      });
    }

    const cleanIdentifier = identifier.trim().toUpperCase();

    const existing = await AccessPolicy.findOne({ identifier: cleanIdentifier });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Credential identifier '${cleanIdentifier}' is already registered.`
      });
    }

    const policy = new AccessPolicy({
      policyId,
      homeId,
      credentialType,
      identifier: cleanIdentifier,
      holderName,
      userRole,
      notificationEmail: notificationEmail ? notificationEmail.trim() : '',
      schedule: {
        is24x7: schedule.is24x7 ?? true,
        allowedDays: schedule.allowedDays || [0, 1, 2, 3, 4, 5, 6],
        timeStart: schedule.timeStart || '00:00',
        timeEnd: schedule.timeEnd || '23:59'
      },
      isActive,
      validUntil,
      notes
    });

    const saved = await policy.save();

    res.status(201).json({
      success: true,
      message: 'Access policy created successfully (CRUD: CREATE)',
      data: saved
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. READ (ALL) - GET /api/policies
router.get('/', async (req, res) => {
  try {
    const { homeId = 'home_uk_01', credentialType, isActive } = req.query;

    const query = { homeId };
    if (credentialType) query.credentialType = credentialType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const policies = await AccessPolicy.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: policies.length,
      data: policies
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. READ (SINGLE) - GET /api/policies/:id
router.get('/:id', async (req, res) => {
  try {
    const policy = await AccessPolicy.findOne({
      $or: [{ policyId: req.params.id }, { identifier: req.params.id }]
    });

    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }

    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. UPDATE - PUT /api/policies/:id
router.put('/:id', async (req, res) => {
  try {
    const { holderName, userRole, notificationEmail, isActive, schedule, validUntil, notes } = req.body;

    const updateFields = {};
    if (holderName !== undefined) updateFields.holderName = holderName;
    if (userRole !== undefined) updateFields.userRole = userRole;
    if (notificationEmail !== undefined) updateFields.notificationEmail = notificationEmail ? notificationEmail.trim() : '';
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (schedule !== undefined) updateFields.schedule = schedule;
    if (validUntil !== undefined) updateFields.validUntil = validUntil;
    if (notes !== undefined) updateFields.notes = notes;

    const updated = await AccessPolicy.findOneAndUpdate(
      { $or: [{ policyId: req.params.id }, { identifier: req.params.id }] },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }

    res.json({
      success: true,
      message: 'Access policy updated successfully (CRUD: UPDATE)',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE - DELETE /api/policies/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await AccessPolicy.findOneAndDelete({
      $or: [{ policyId: req.params.id }, { identifier: req.params.id }]
    });

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }

    res.json({
      success: true,
      message: `Access policy for '${deleted.holderName}' deleted successfully (CRUD: DELETE)`,
      deletedId: deleted.policyId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// VERIFY CREDENTIAL - POST /api/policies/verify
router.post('/verify', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifier is required' });
    }

    const cleanIdentifier = identifier.trim().toUpperCase();
    const policy = await AccessPolicy.findOne({ identifier: cleanIdentifier, isActive: true });

    if (!policy) {
      if (req.body.notify !== false) {
        sendUnauthorizedAttemptNotification({
          homeId: 'home_uk_01',
          gateId: 'gate_main_01',
          credentialType: req.body.credentialType || 'UNKNOWN_CREDENTIAL',
          identifier: cleanIdentifier,
          method: req.body.method || 'API_CREDENTIAL_VERIFY',
          reason: 'Unregistered or inactive credential',
          timestamp: new Date()
        }).catch(err => console.error('[Policy Verify] Unauthorized alert email failed:', err));
      }

      return res.json({
        authorized: false,
        reason: 'Unregistered or inactive credential'
      });
    }

    // Check validity date
    if (policy.validUntil && new Date() > new Date(policy.validUntil)) {
      if (req.body.notify !== false) {
        sendUnauthorizedAttemptNotification({
          homeId: policy.homeId || 'home_uk_01',
          gateId: 'gate_main_01',
          credentialType: policy.credentialType,
          identifier: cleanIdentifier,
          method: req.body.method || 'API_CREDENTIAL_VERIFY',
          reason: `Credential expired on ${new Date(policy.validUntil).toISOString()}`,
          timestamp: new Date()
        }).catch(err => console.error('[Policy Verify] Expired credential alert email failed:', err));
      }

      return res.json({
        authorized: false,
        reason: 'Credential expired'
      });
    }

    // Routine authorized access is granted quietly without email dispatch (emails reserved strictly for unauthorized attempts)

    res.json({
      authorized: true,
      holderName: policy.holderName,
      userRole: policy.userRole,
      credentialType: policy.credentialType,
      notificationEmail: policy.notificationEmail || ''
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
