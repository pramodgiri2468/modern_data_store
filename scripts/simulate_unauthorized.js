#!/usr/bin/env node
require('dotenv').config();
const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const args = process.argv.slice(2);

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
    } catch {
      console.log('Response:', body);
    }
  });
});

req.on('error', async (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.log(`[sim] Server not running on port ${PORT}; falling back to direct database execution...`);
    try {
      const { connectDB } = require('../backend/config/database');
      await connectDB();
      const { emitUnauthorizedSensorEvent } = require('../backend/services/telemetryEmitter');
      const result = await emitUnauthorizedSensorEvent({
        type: eventType,
        identifier: payloadObj.identifier,
        reason: payloadObj.reason
      });
      printSummary(201, 'Unauthorized sensor event recorded and alert email dispatched to pg016742@gmail.com', result);
      setTimeout(() => process.exit(0), 1000);
    } catch (dbErr) {
      console.error(`[sim] Direct execution error: ${dbErr.message}`);
      process.exit(1);
    }
  } else {
    console.error(`[sim] Request error: ${err.message}`);
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
      console.log(`Recipient:   ${data.emailNotification.recipient}`);
      if (data.emailNotification.previewUrl) {
        console.log(`Preview:     ${data.emailNotification.previewUrl}`);
      }
    }
  }
  console.log('');
}

req.write(payload);
req.end();
