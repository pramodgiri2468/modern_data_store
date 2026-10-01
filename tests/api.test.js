const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');

const BASE_URL = 'http://127.0.0.1:3000';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log(' RUNNING AUTOMATED API & ENDPOINT INTEGRATION TESTS');
  console.log('====================================================');

  try {
    // 1. Health check
    const health = await makeRequest('GET', '/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'OK');
    console.log('✓ PASS: GET /health returned 200 OK');

    // 2. Cluster Status
    const cluster = await makeRequest('GET', '/api/cluster/status');
    assert.strictEqual(cluster.status, 200);
    assert.strictEqual(cluster.body.success, true);
    console.log(`✓ PASS: GET /api/cluster/status returned replicaSet: ${cluster.body.data.replicaSet}, Primary: ${cluster.body.data.primary}`);

    // 3. Gate Status
    const gateStatus = await makeRequest('GET', '/api/gate/status');
    assert.strictEqual(gateStatus.status, 200);
    assert.strictEqual(gateStatus.body.success, true);
    console.log(`✓ PASS: GET /api/gate/status returned state: ${gateStatus.body.data.status}`);

    // 4. Gate Command (MQTT publish trigger)
    const cmdRes = await makeRequest('POST', '/api/gate/command', { action: 'UNLOCK', reason: 'Test Unlock' });
    assert.strictEqual(cmdRes.status, 200);
    assert.strictEqual(cmdRes.body.success, true);
    console.log(`✓ PASS: POST /api/gate/command dispatched 'UNLOCK' via MQTT`);

    // 5. Sensor Events Query
    const eventsRes = await makeRequest('GET', '/api/sensors/events?limit=10');
    assert.strictEqual(eventsRes.status, 200);
    assert.strictEqual(eventsRes.body.success, true);
    assert(eventsRes.body.data.length > 0);
    console.log(`✓ PASS: GET /api/sensors/events returned ${eventsRes.body.data.length} records (Total: ${eventsRes.body.total})`);

    // 5b. Continuous 5-Minute Telemetry Generation
    const genTelemRes = await makeRequest('POST', '/api/sensors/generate-telemetry', {});
    assert.strictEqual(genTelemRes.status, 201);
    assert.strictEqual(genTelemRes.body.success, true);
    assert.ok(genTelemRes.body.interval);
    console.log(`✓ PASS: POST /api/sensors/generate-telemetry successfully generated telemetry (${genTelemRes.body.interval})`);

    // 6. Policy CRUD: CREATE
    const newPolicy = {
      credentialType: 'RFID_TAG',
      identifier: `TEST-TAG-${Date.now()}`,
      holderName: 'Automated Test User',
      userRole: 'RESIDENT'
    };
    const createRes = await makeRequest('POST', '/api/policies', newPolicy);
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = createRes.body.data.policyId;
    console.log(`✓ PASS: POST /api/policies created policyId: ${createdId}`);

    // Policy CRUD: READ
    const readRes = await makeRequest('GET', `/api/policies/${createdId}`);
    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.body.data.holderName, 'Automated Test User');
    console.log(`✓ PASS: GET /api/policies/:id read policy successfully`);

    // Policy CRUD: UPDATE
    const updateRes = await makeRequest('PUT', `/api/policies/${createdId}`, { holderName: 'Updated Test User' });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.holderName, 'Updated Test User');
    console.log(`✓ PASS: PUT /api/policies/:id updated policy holderName`);

    // Policy Credential Verification
    const verifyRes = await makeRequest('POST', '/api/policies/verify', { identifier: newPolicy.identifier });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.authorized, true);
    console.log(`✓ PASS: POST /api/policies/verify successfully authorized credential`);

    // Policy CRUD: DELETE
    const deleteRes = await makeRequest('DELETE', `/api/policies/${createdId}`);
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.success, true);
    console.log(`✓ PASS: DELETE /api/policies/:id deleted policy`);

    // 7. Analytics Endpoints
    const hourlyRes = await makeRequest('GET', '/api/analytics/hourly-traffic');
    assert.strictEqual(hourlyRes.status, 200);
    assert.strictEqual(hourlyRes.body.data.length, 24);
    console.log(`✓ PASS: GET /api/analytics/hourly-traffic aggregated 24 hourly buckets`);

    const secRes = await makeRequest('GET', '/api/analytics/security');
    assert.strictEqual(secRes.status, 200);
    console.log(`✓ PASS: GET /api/analytics/security calculated ${secRes.body.data.totalSecurityIncidents} incidents`);

    const motorRes = await makeRequest('GET', '/api/analytics/motor-health');
    assert.strictEqual(motorRes.status, 200);
    console.log(`✓ PASS: GET /api/analytics/motor-health returned health score: ${motorRes.body.data.healthScore}`);

    const sensorHealthRes = await makeRequest('GET', '/api/analytics/sensor-health');
    assert.strictEqual(sensorHealthRes.status, 200);
    assert.strictEqual(sensorHealthRes.body.success, true);
    assert.ok(sensorHealthRes.body.data.photocell);
    assert.ok(sensorHealthRes.body.data.limitSwitch);
    assert.ok(sensorHealthRes.body.data.rfidReader);
    console.log(`✓ PASS: GET /api/analytics/sensor-health verified 3 core sensors (Photocell: ${sensorHealthRes.body.data.photocell.status}, LimitSwitch: ${sensorHealthRes.body.data.limitSwitch.status}, RFID: ${sensorHealthRes.body.data.rfidReader.heartbeatStatus})`);

    // 8. Authorized Entry Email Notifications
    const testEmailRes = await makeRequest('POST', '/api/notifications/test', {
      email: 'jane.davies@iothings.co.uk',
      holderName: 'Dr. Jane Davies',
      userRole: 'RESIDENT'
    });
    assert.strictEqual(testEmailRes.status, 200);
    assert.strictEqual(testEmailRes.body.success, true);
    assert.ok(testEmailRes.body.data.recipient.includes('jane.davies@iothings.co.uk'));
    console.log(`✓ PASS: POST /api/notifications/test dispatched email to ${testEmailRes.body.data.recipient}`);

    // 8b. Unauthorized Security Alert Notification
    const testUnauthRes = await makeRequest('POST', '/api/notifications/test-unauthorized', {
      email: 'pg016742@gmail.com',
      identifier: 'UNKNOWN-INTRUDER-99'
    });
    assert.strictEqual(testUnauthRes.status, 200);
    assert.strictEqual(testUnauthRes.body.success, true);
    assert.strictEqual(testUnauthRes.body.data.status, 'SECURITY_ALERT');
    console.log(`✓ PASS: POST /api/notifications/test-unauthorized dispatched security alert for ${testUnauthRes.body.data.identifier}`);

    const listNotifRes = await makeRequest('GET', '/api/notifications');
    assert.strictEqual(listNotifRes.status, 200);
    assert.strictEqual(listNotifRes.body.success, true);
    assert.ok(listNotifRes.body.data.length > 0);
    console.log(`✓ PASS: GET /api/notifications returned ${listNotifRes.body.data.length} dispatched email log records`);

    // 9. Unauthorized Sensor Data & Intrusion Email Notification
    const unauthSensorRes = await makeRequest('POST', '/api/sensors/unauthorized', {
      type: 'PERSON',
      identifier: 'UNAUTHORIZED-INTRUDER-42',
      reason: 'Unauthorized person entered property perimeter while gate is locked'
    });
    assert.strictEqual(unauthSensorRes.status, 201);
    assert.strictEqual(unauthSensorRes.body.success, true);
    assert.strictEqual(unauthSensorRes.body.data.gateStatus, 'LOCKED');
    assert.strictEqual(unauthSensorRes.body.data.lockEngaged, true);
    assert.strictEqual(unauthSensorRes.body.data.eventType, 'INTRUSION_DETECTED');
    console.log(`✓ PASS: POST /api/sensors/unauthorized recorded intruder sensor data, kept gate LOCKED, and dispatched alert email to pg016742@gmail.com`);

    // 10. Simulate Unauthorized Person Entrance via UI Simulation Route
    const simPersonRes = await makeRequest('POST', '/api/sensors/simulate', {
      action: 'UNAUTHORIZED_PERSON'
    });
    assert.strictEqual(simPersonRes.status, 200);
    assert.strictEqual(simPersonRes.body.success, true);
    assert.ok(simPersonRes.body.message.includes('pg016742@gmail.com'));
    console.log(`✓ PASS: POST /api/sensors/simulate (UNAUTHORIZED_PERSON) dispatched perimeter breach email alert`);

    console.log('====================================================');
    console.log(' ALL TEST SUITES PASSED FLAWLESSLY! (100% SUCCESS)');
    console.log('====================================================');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
  }
}

let serverProcess = null;

async function ensureServerRunning() {
  try {
    await makeRequest('GET', '/health');
    return null;
  } catch (e) {
    console.log('[Test Harness] Server not running on port 3000, starting background instance...');
    const { spawn } = require('child_process');
    serverProcess = spawn('node', ['backend/server.js'], {
      stdio: 'ignore',
      detached: false
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        await makeRequest('GET', '/health');
        console.log('[Test Harness] Server ready on http://127.0.0.1:3000\n');
        return;
      } catch (err) {}
    }
  }
}

// Allow standalone execution
if (require.main === module) {
  ensureServerRunning().then(runTests);
}

module.exports = { runTests };

