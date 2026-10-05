#!/usr/bin/env node
require('dotenv').config();
const { sendUnauthorizedAttemptNotification } = require('../backend/services/emailService');

async function testEmail() {
  const targetEmail = process.env.DEFAULT_ALERT_EMAIL || 'pg016742@gmail.com';
  console.log('[test:email] Testing alert notification dispatch...');
  console.log(`[test:email] Recipient: ${targetEmail}`);
  console.log(`[test:email] SMTP host: ${process.env.SMTP_HOST || 'Ethereal / test account'}`);

  const result = await sendUnauthorizedAttemptNotification({
    homeId: 'home_uk_01',
    gateId: 'gate_main_01',
    credentialType: 'PHYSICAL_INTRUSION',
    identifier: 'UNAUTHORIZED-TEST-01',
    method: 'SECURITY_VERIFICATION_TEST',
    reason: 'Security alert email verification test dispatch',
    timestamp: new Date()
  });

  if (result) {
    console.log('[test:email] Alert dispatched successfully');
    console.log(`  - ID:      ${result.id}`);
    console.log(`  - Subject: ${result.subject}`);
    if (result.previewUrl) {
      console.log(`  - Preview: ${result.previewUrl}`);
    } else {
      console.log(`  - Sent via ${process.env.SMTP_HOST}`);
    }
  } else {
    console.error('[test:email] Failed to dispatch test email');
    process.exit(1);
  }

  process.exit(0);
}

testEmail().catch((err) => {
  console.error('[test:email] Error:', err);
  process.exit(1);
});
