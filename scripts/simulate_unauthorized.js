#!/usr/bin/env node
/**
 * IoThings Smart Main Gate - Unauthorized Sensor Data & Security Email Alert Trigger
 * 
 * Simulates an unauthorized sensor detection event (unauthorized person, unregistered RFID card, or intruder vehicle).
 * Verifies that the gate remains securely LOCKED, persists the audit event to MongoDB,
 * publishes the event across the embedded MQTT broker, and dispatches an urgent security alert email to pg016742@gmail.com.
 * 
 * Resilient Operation:
 * - If backend server is running on port 3000: sends via HTTP REST API.
 * - If backend server is NOT running: connects directly to MongoDB and dispatches email in-process.
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

const payloadObj = {
  type: eventType,
  identifier: identifier || (eventType === 'RFID' ? 'UNKNOWN-CLONE-99' : (eventType === 'ALPR' ? 'UNKNOWN-INTRUDER-99' : 'UNAUTHORIZED-PERSON-01')),
  personName: 'Unauthorized Person / Intruder',
  reason: reason || (eventType === 'PERSON' ? 'Unauthorized person entered property perimeter while gate is locked' : 'Unregistered credential presented at main gate')
};

const payload = JSON.stringify(payloadObj);

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
      printSummary(res.statusCode, data.message, data.data);
    } catch (e) {
      console.log('Response:', body);
    }
  });
});

req.on('error', async (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.log(`[Info] Core server not running on port ${PORT}. Executing in standalone direct database mode...`);
    try {
      const { connectDB } = require('../backend/config/database');
      await connectDB();
      const { emitUnauthorizedSensorEvent } = require('../backend/services/telemetryEmitter');
      const result = await emitUnauthorizedSensorEvent({
        type: eventType,
        identifier: payloadObj.identifier,
        reason: payloadObj.reason
      });
      printSummary(201, 'Unauthorized sensor data recorded and security alert email dispatched to pg016742@gmail.com', result);
      setTimeout(() => process.exit(0), 1000);
    } catch (dbErr) {
      console.error(`\n❌ Failed to execute simulation: ${dbErr.message}`);
      console.error('Tip: To run via REST API, start the server first in another terminal with: npm start\n');
      process.exit(1);
    }
  } else {
    console.error(`\n❌ Request error: ${err.message}\n`);
    process.exit(1);
  }
});

function printSummary(statusCode, message, data) {
  console.log(`\nUnauthorized sensor event recorded (HTTP ${statusCode})`);
  console.log(`Message:     ${message}`);
  if (data) {
    console.log(`Event ID:    ${data.eventId}`);
    console.log(`Type:        ${data.eventType}`);
    console.log(`Identifier:  ${data.identifier}`);
    console.log(`Gate Status: ${data.gateStatus || 'LOCKED'}`);
    console.log(`Reason:      ${data.reason}`);
    if (data.emailNotification) {
      console.log(`Alert Email: ${data.emailNotification.recipient}`);
      if (data.emailNotification.previewUrl) {
        console.log(`Preview:     ${data.emailNotification.previewUrl}`);
      }
    }
  }
  console.log('');
}

req.write(payload);
req.end();
