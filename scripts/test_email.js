#!/usr/bin/env node
/**
 * IoThings Email Delivery Verification Script
 * Tests live email notification dispatching to pg016742@gmail.com
 */

require('dotenv').config();
const { sendUnauthorizedAttemptNotification } = require('../backend/services/emailService');

async function testEmail() {
  const targetEmail = process.env.DEFAULT_ALERT_EMAIL || 'pg016742@gmail.com';
  console.log('========================================================================');
  console.log('📧 IoThings Email Dispatch Verification');
  console.log(` Target Recipient: ${targetEmail}`);
  console.log(` SMTP Host:       ${process.env.SMTP_HOST || 'Ethereal / Simulated (No SMTP_HOST in .env)'}`);
  console.log(` SMTP User:       ${process.env.SMTP_USER || 'N/A'}`);
  console.log('========================================================================\n');

  console.log('Sending test unauthorized security alert...');
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
    console.log('\n========================================================================');
    console.log('✓ SUCCESS: Email notification dispatched successfully!');
    console.log(`  ├─ Alert ID:      ${result.id}`);
    console.log(`  ├─ Recipient:     ${result.recipient}`);
    console.log(`  ├─ Subject:       ${result.subject}`);
    if (result.previewUrl) {
      console.log(`  └─ 🔗 Live Web Preview: ${result.previewUrl}`);
      console.log('\n👉 Click the link above to view the exact rendered HTML email!');
    } else {
      console.log(`  └─ Real Gmail Delivery: Delivered via ${process.env.SMTP_HOST}`);
      console.log(`\n👉 Please check your Gmail inbox at: ${targetEmail} (also check Spam/Junk folder if not in Primary).`);
    }
    console.log('========================================================================\n');
  } else {
    console.error('❌ Failed to dispatch email. Check terminal output above.');
  }

  process.exit(0);
}

testEmail().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
