const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const GateEvent = require('../backend/models/GateEvent');
const AccessPolicy = require('../backend/models/AccessPolicy');
const {
  getHourlyTraffic,
  getSecurityAnalytics,
  getMotorHealth,
  getSensorHealthAnalytics
} = require('../backend/services/analyticsService');

const MONGO_URI = process.env.MONGO_URI || 
  'mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/iothings_gate?replicaSet=rs0&readPreference=primaryPreferred';

function ms(durationBigInt) {
  return parseFloat((Number(durationBigInt) / 1e6).toFixed(2));
}

async function runEvaluation() {
  console.log('[bench] Connecting to MongoDB cluster at', MONGO_URI);
  const startTime = Date.now();
  await mongoose.connect(MONGO_URI);
  console.log('[bench] Connected. Starting evaluation run...');

  const results = {
    timestamp: new Date().toISOString(),
    replicaSet: 'rs0',
    benchmarks: {}
  };

  // 1. Cluster Topology
  console.log('\n--- Topology Inspection ---');
  const adminDb = mongoose.connection.db.admin();
  const replStatus = await adminDb.command({ replSetGetStatus: 1 });
  const isMaster = await adminDb.command({ isMaster: 1 });

  console.log(`Replica set: ${replStatus.set}`);
  console.log(`Primary:     ${isMaster.primary}`);
  console.log(`Members:     ${replStatus.members.length}`);
  replStatus.members.forEach((m) => {
    console.log(`  - ${m.name}: state=${m.stateStr}, health=${m.health}, ping=${m.pingMs || 0}ms`);
  });

  results.topology = {
    set: replStatus.set,
    primary: isMaster.primary,
    members: replStatus.members.map((m) => ({
      name: m.name,
      state: m.stateStr,
      health: m.health,
      pingMs: m.pingMs || 0
    }))
  };

  // 2. CRUD Operations
  console.log('\n--- CRUD Latency ---');
  
  // Create
  const cStart = process.hrtime.bigint();
  const testPolicy = new AccessPolicy({
    policyId: 'BENCH-POL-01',
    homeId: 'home_uk_01',
    credentialType: 'RFID_TAG',
    identifier: 'RFID-BENCH-999',
    holderName: 'Benchmark Resident',
    userRole: 'RESIDENT'
  });
  await testPolicy.save();
  const createMs = ms(process.hrtime.bigint() - cStart);
  console.log(`Insert (Create): ${createMs} ms`);

  // Read
  const rStart = process.hrtime.bigint();
  await AccessPolicy.findOne({ identifier: 'RFID-BENCH-999' }).lean();
  const readMs = ms(process.hrtime.bigint() - rStart);
  console.log(`Find (Read):     ${readMs} ms`);

  // Update
  const uStart = process.hrtime.bigint();
  await AccessPolicy.updateOne(
    { identifier: 'RFID-BENCH-999' },
    { $set: { notes: 'Updated in benchmark run', userRole: 'STAFF' } }
  );
  const updateMs = ms(process.hrtime.bigint() - uStart);
  console.log(`Update:          ${updateMs} ms`);

  // Delete
  const dStart = process.hrtime.bigint();
  await AccessPolicy.deleteOne({ identifier: 'RFID-BENCH-999' });
  const deleteMs = ms(process.hrtime.bigint() - dStart);
  console.log(`Delete:          ${deleteMs} ms`);

  results.benchmarks.crud = { createMs, readMs, updateMs, deleteMs };

  // 3. Write Concern Latency Comparison (w:1 vs w:majority)
  console.log('\n--- Write Concern Latency ---');

  const w1Start = process.hrtime.bigint();
  await GateEvent.create([{
    eventId: `BENCH-W1-${Date.now()}`,
    homeId: 'home_uk_01',
    gateId: 'gate_main_01',
    eventType: 'RFID_ENTRY_SUCCESS',
    sensorId: 'DEV-RFID-01',
    payload: { notes: 'Write Concern w:1 test' }
  }], { writeConcern: { w: 1 } });
  const w1Ms = ms(process.hrtime.bigint() - w1Start);
  console.log(`w:1 (Primary only):         ${w1Ms} ms`);

  const wMajStart = process.hrtime.bigint();
  await GateEvent.create([{
    eventId: `BENCH-WMAJ-${Date.now()}`,
    homeId: 'home_uk_01',
    gateId: 'gate_main_01',
    eventType: 'RFID_ENTRY_SUCCESS',
    sensorId: 'DEV-RFID-01',
    payload: { notes: 'Write Concern w:majority test' }
  }], { writeConcern: { w: 'majority', j: true } });
  const wMajorityMs = ms(process.hrtime.bigint() - wMajStart);
  console.log(`w:majority (Replicated & J): ${wMajorityMs} ms`);

  results.benchmarks.writeConcern = { w1Ms, wMajorityMs };

  // 4. Aggregation Pipelines
  console.log('\n--- Aggregation Pipelines ---');

  const agg1Start = process.hrtime.bigint();
  await getHourlyTraffic('home_uk_01', 30);
  const hourlyTrafficMs = ms(process.hrtime.bigint() - agg1Start);
  console.log(`Hourly traffic aggregation:  ${hourlyTrafficMs} ms`);

  const agg2Start = process.hrtime.bigint();
  const securityStats = await getSecurityAnalytics('home_uk_01', 30);
  const securityStatsMs = ms(process.hrtime.bigint() - agg2Start);
  console.log(`Security incidents pipeline: ${securityStatsMs} ms (${securityStats.totalSecurityIncidents} incidents)`);

  const agg3Start = process.hrtime.bigint();
  const motorHealth = await getMotorHealth('gate_main_01');
  const motorHealthMs = ms(process.hrtime.bigint() - agg3Start);
  console.log(`Motor health score pipeline: ${motorHealthMs} ms (Score: ${motorHealth.healthScore})`);

  const agg4Start = process.hrtime.bigint();
  const sensorHealth = await getSensorHealthAnalytics('gate_main_01');
  const sensorHealthMs = ms(process.hrtime.bigint() - agg4Start);
  console.log(`Sensor health analytics:     ${sensorHealthMs} ms (Photocell: ${sensorHealth.photocell.status})`);

  results.benchmarks.aggregations = {
    hourlyTrafficMs,
    securityStatsMs,
    motorHealthMs,
    sensorHealthMs
  };

  const elapsed = Date.now() - startTime;
  console.log(`\n[bench] Completed all benchmarks in ${elapsed} ms`);

  await mongoose.disconnect();
  return results;
}

runEvaluation()
  .then((res) => {
    const targetPath = path.resolve(__dirname, '../report/benchmark_results.json');
    fs.writeFileSync(targetPath, JSON.stringify(res, null, 2));
    console.log(`[bench] Metrics saved to ${targetPath}`);
  })
  .catch((err) => {
    console.error('[bench] Evaluation failed:', err);
    process.exit(1);
  });
