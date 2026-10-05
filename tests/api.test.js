const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');

const BASE_URL = 'http://127.0.0.1:3000';
let serverProcess = null;

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
        } catch {
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
  console.log('Running API integration test suite...\n');

  try {
    // Health check
    const health = await makeRequest('GET', '/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'OK');
    console.log('✓ GET /health (200 OK)');

    // Cluster Status
    const cluster = await makeRequest('GET', '/api/cluster/status');
    assert.strictEqual(cluster.status, 200);
    assert.strictEqual(cluster.body.success, true);
    console.log(`✓ GET /api/cluster/status (rs: ${cluster.body.data.replicaSet}, primary: ${cluster.body.data.primary})`);

    // Gate Status
    const gateStatus = await makeRequest('GET', '/api/gate/status');
    assert.strictEqual(gateStatus.status, 200);
    assert.strictEqual(gateStatus.body.success, true);
    console.log(`✓ GET /api/gate/status (state: ${gateStatus.body.data.status})`);

    // Gate Command
    const cmdRes = await makeRequest('POST', '/api/gate/command', { action: 'UNLOCK', reason: 'Test Unlock' });
    assert.strictEqual(cmdRes.status, 200);
    assert.strictEqual(cmdRes.body.success, true);
    console.log('✓ POST /api/gate/command (dispatched UNLOCK via MQTT)');

    // Sensor Events Query
    const eventsRes = await makeRequest('GET', '/api/sensors/events?limit=10');
    assert.strictEqual(eventsRes.status, 200);
    assert.strictEqual(eventsRes.body.success, true);
    assert(eventsRes.body.data.length > 0);
    console.log(`✓ GET /api/sensors/events (${eventsRes.body.data.length} records returned, total: ${eventsRes.body.total})`);

    // Telemetry generation (FULLY_CLOSED)
    const genClosedRes = await makeRequest('POST', '/api/sensors/generate-telemetry', { restingState: 'FULLY_CLOSED', status: 'IDLE_CLOSED' });
    assert.strictEqual(genClosedRes.status, 201);
    assert.strictEqual(genClosedRes.body.success, true);
    assert.strictEqual(genClosedRes.body.restingState, 'FULLY_CLOSED');
    assert.strictEqual(genClosedRes.body.data.limitSwitch.restingState, 'FULLY_CLOSED');
    assert.strictEqual(genClosedRes.body.data.metrics.reedSwitchState, 'CLOSED');
    console.log('✓ POST /api/sensors/generate-telemetry (FULLY_CLOSED boundary verified)');

    // Telemetry generation (FULLY_OPEN)
    const genOpenRes = await makeRequest('POST', '/api/sensors/generate-telemetry', { restingState: 'FULLY_OPEN', status: 'OPEN' });
    assert.strictEqual(genOpenRes.status, 201);
    assert.strictEqual(genOpenRes.body.success, true);
    assert.strictEqual(genOpenRes.body.restingState, 'FULLY_OPEN');
    assert.strictEqual(genOpenRes.body.data.limitSwitch.restingState, 'FULLY_OPEN');
    assert.strictEqual(genOpenRes.body.data.metrics.reedSwitchState, 'OPEN');
    console.log('✓ POST /api/sensors/generate-telemetry (FULLY_OPEN boundary verified)');

    // Policy CRUD: CREATE
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
    console.log(`✓ POST /api/policies (created ${createdId})`);

    // Policy CRUD: READ
    const readRes = await makeRequest('GET', `/api/policies/${createdId}`);
    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.body.data.holderName, 'Automated Test User');
    console.log('✓ GET /api/policies/:id (retrieved policy)');

    // Policy CRUD: UPDATE
    const updateRes = await makeRequest('PUT', `/api/policies/${createdId}`, { holderName: 'Updated Test User' });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.holderName, 'Updated Test User');
    console.log('✓ PUT /api/policies/:id (updated policy)');

    // Policy credential verification
    const verifyRes = await makeRequest('POST', '/api/policies/verify', { identifier: newPolicy.identifier });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.authorized, true);
    console.log('✓ POST /api/policies/verify (authorized credential)');

    // Policy CRUD: DELETE
    const deleteRes = await makeRequest('DELETE', `/api/policies/${createdId}`);
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.success, true);
    console.log('✓ DELETE /api/policies/:id (removed policy)');

    // Analytics: Hourly Traffic
    const hourlyRes = await makeRequest('GET', '/api/analytics/hourly-traffic');
    assert.strictEqual(hourlyRes.status, 200);
    assert.strictEqual(hourlyRes.body.data.length, 24);
    console.log('✓ GET /api/analytics/hourly-traffic (24 buckets returned)');

    // Analytics: Security Incidents
    const secRes = await makeRequest('GET', '/api/analytics/security');
    assert.strictEqual(secRes.status, 200);
    console.log(`✓ GET /api/analytics/security (${secRes.body.data.totalSecurityIncidents} incidents calculated)`);

    // Analytics: Motor Health
    const motorRes = await makeRequest('GET', '/api/analytics/motor-health');
    assert.strictEqual(motorRes.status, 200);
    console.log(`✓ GET /api/analytics/motor-health (score: ${motorRes.body.data.healthScore})`);

    // Analytics: Sensor Health
    const sensorHealthRes = await makeRequest('GET', '/api/analytics/sensor-health');
    assert.strictEqual(sensorHealthRes.status, 200);
    assert.strictEqual(sensorHealthRes.body.success, true);
    assert.ok(sensorHealthRes.body.data.photocell);
    assert.ok(sensorHealthRes.body.data.limitSwitch);
    assert.ok(sensorHealthRes.body.data.rfidReader);
    console.log(`✓ GET /api/analytics/sensor-health (Photocell: ${sensorHealthRes.body.data.photocell.status}, LimitSwitch: ${sensorHealthRes.body.data.limitSwitch.status}, RFID: ${sensorHealthRes.body.data.rfidReader.heartbeatStatus})`);

    // Routine Access Notification (no email dispatch)
    const testEmailRes = await makeRequest('POST', '/api/notifications/test', {
      email: 'jane.davies@iothings.co.uk',
      holderName: 'Dr. Jane Davies',
      userRole: 'RESIDENT'
    });
    assert.strictEqual(testEmailRes.status, 200);
    assert.strictEqual(testEmailRes.body.success, true);
    assert.strictEqual(testEmailRes.body.data.emailDispatched, false);
    assert.ok(testEmailRes.body.data.recipient.includes('jane.davies@iothings.co.uk'));
    console.log('✓ POST /api/notifications/test (routine entry suppressed)');

    // Security Alert Notification
    const testUnauthRes = await makeRequest('POST', '/api/notifications/test-unauthorized', {
      email: 'pg016742@gmail.com',
      identifier: 'UNKNOWN-INTRUDER-99'
    });
    assert.strictEqual(testUnauthRes.status, 200);
    assert.strictEqual(testUnauthRes.body.success, true);
    assert.strictEqual(testUnauthRes.body.data.status, 'SECURITY_ALERT');
    console.log(`✓ POST /api/notifications/test-unauthorized (alert dispatched for ${testUnauthRes.body.data.identifier})`);

    // Notification Log Query
    const listNotifRes = await makeRequest('GET', '/api/notifications');
    assert.strictEqual(listNotifRes.status, 200);
    assert.strictEqual(listNotifRes.body.success, true);
    assert.ok(listNotifRes.body.data.length > 0);
    console.log(`✓ GET /api/notifications (${listNotifRes.body.data.length} records retrieved)`);

    // Unauthorized Sensor Data Endpoint
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
    console.log('✓ POST /api/sensors/unauthorized (lock preserved, alert sent to pg016742@gmail.com)');

    // Simulated Person Intrusion via UI route
    const simPersonRes = await makeRequest('POST', '/api/sensors/simulate', {
      action: 'UNAUTHORIZED_PERSON'
    });
    assert.strictEqual(simPersonRes.status, 200);
    assert.strictEqual(simPersonRes.body.success, true);
    assert.ok(simPersonRes.body.message.includes('pg016742@gmail.com'));
    console.log('✓ POST /api/sensors/simulate (UNAUTHORIZED_PERSON handled)');

    console.log('\nAll 18 tests passed successfully.');
  } catch (err) {
    console.error('\nTest failed:', err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
    process.exit(0);
  }
}

async function ensureServerRunning() {
  try {
    await makeRequest('GET', '/health');
    return null;
  } catch {
    console.log('[test:harness] Server not running on port 3000; spawning background instance...');
    serverProcess = spawn('node', ['backend/server.js'], {
      stdio: 'ignore',
      detached: false
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        await makeRequest('GET', '/health');
        console.log('[test:harness] Server ready on http://127.0.0.1:3000\n');
        return;
      } catch {}
    }
  }
}

if (require.main === module) {
  ensureServerRunning().then(runTests);
}

module.exports = { runTests };
