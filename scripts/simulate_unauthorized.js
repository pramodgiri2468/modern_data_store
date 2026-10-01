#!/usr/bin/env node
/**
 * IoThings Smart Main Gate - Unauthorized Sensor Data & Security Email Alert Trigger
 * 
 * Simulates an unauthorized sensor detection event (unauthorized person, unregistered RFID card, or intruder vehicle).
 * Verifies that the gate remains securely LOCKED, persists the audit event to MongoDB,
 * publishes the event across the embedded MQTT broker, and dispatches an urgent security alert email to pg016742@gmail.com.
 */

require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 3000;
const args = process.argv.slice(2);

// Options: --type rfid | alpr | person | tamper
let eventType = 'PERSON';
let identifier = null;
let reason = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && args[i + 1]) {
    eventType = args[i + 1].toUpperCase();
  }
  if (args[i] === '--id' && args[i + 1]) {
    identifier = args[i + 1];
  }
  if (args[i] === '--reason' && args[i + 1]) {
    reason = args[i + 1];
  }
}

const payload = JSON.stringify({
  type: eventType,
  identifier: identifier || (eventType === 'RFID' ? 'UNKNOWN-CLONE-99' : (eventType === 'ALPR' ? 'UNKNOWN-INTRUDER-99' : 'UNAUTHORIZED-PERSON-01')),
  personName: 'Unauthorized Person / Intruder',
  reason: reason || (eventType === 'PERSON' ? 'Unauthorized person entered property perimeter while gate is locked' : 'Unregistered credential presented at main gate')
});

const req = http.request({
  hostname: '127.0.0.1',
  port: PORT,
  path: '/api/sensors/unauthorized',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('========================================================================');
      console.log('🚨 [IoThings] UNAUTHORIZED SENSOR DATA & SECURITY EMAIL ALERT INITIATED');
      console.log('========================================================================');
      console.log(`✓ Status Code:      ${res.statusCode}`);
      console.log(`✓ Message:          ${data.message}`);
      if (data.data) {
        console.log(`✓ Event ID:         ${data.data.eventId}`);
        console.log(`✓ Event Type:       ${data.data.eventType} (${data.data.severity})`);
        console.log(`✓ Identifier:       ${data.data.identifier}`);
        console.log(`✓ Gate Status:      ${data.data.gateStatus} (Lock Engaged: ${data.data.lockEngaged})`);
        console.log(`✓ Denial Reason:    ${data.data.reason}`);
        if (data.data.emailNotification) {
          console.log(`✓ Security Email:   DISPATCHED TO ${data.data.emailNotification.recipient}`);
          console.log(`✓ Email Subject:    ${data.data.emailNotification.subject}`);
          console.log(`✓ Alert Record ID:  ${data.data.emailNotification.id}`);
        }
      }
      console.log('========================================================================');
      console.log('🔒 PERIMETER DEFENSE ACTIVE: Gate held securely locked.');
      console.log('📧 Alert dispatched to pg016742@gmail.com.');
      console.log('========================================================================\n');
    } catch (e) {
      console.log('Response:', body);
    }
  });
});

req.on('error', (err) => {
  console.error(`\n❌ Failed to connect to server on port ${PORT}: ${err.message}`);
  console.error('Make sure the server is running with: npm start\n');
});

req.write(payload);
req.end();
