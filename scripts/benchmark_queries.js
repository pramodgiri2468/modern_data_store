const mongoose = require('mongoose');
const GateEvent = require('../backend/models/GateEvent');
const GateTelemetry = require('../backend/models/GateTelemetry');
const AccessPolicy = require('../backend/models/AccessPolicy');
const { getHourlyTraffic, getSecurityAnalytics, getMotorHealth, getSensorHealthAnalytics } = require('../backend/services/analyticsService');

const MONGO_URI = process.env.MONGO_URI || 
  'mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/iothings_gate?replicaSet=rs0&readPreference=primaryPreferred';

async function runEvaluation() {
  console.log('================================================================');
  console.log(' CMP6207 MODERN DATA STORES - EXPERIMENTAL EVALUATION HARNESS');
  console.log(' Evaluating MongoDB 3-Node Replica Set, CRUD & Aggregations');
  console.log('================================================================');

  const startTime = Date.now();
  await mongoose.connect(MONGO_URI);
  console.log('Connected to Cluster.');

  const results = {
    timestamp: new Date().toISOString(),
    replicaSet: 'rs0',
    benchmarks: {}
  };

  // 1. Cluster Topology and Health Check
  console.log('\n--- 1. CLUSTER TOPOLOGY EVALUATION ---');
  const adminDb = mongoose.connection.db.admin();
  const replStatus = await adminDb.command({ replSetGetStatus: 1 });
  const isMaster = await adminDb.command({ isMaster: 1 });

  console.log(`Cluster Set Name: ${replStatus.set}`);
  console.log(`Active Primary: ${isMaster.primary}`);
  console.log(`Total Configured Members: ${replStatus.members.length}`);
  replStatus.members.forEach(m => {
    console.log(`  - Node ${m.name}: State=${m.stateStr}, Health=${m.health}, Ping=${m.pingMs || 0}ms`);
  });

  results.topology = {
    set: replStatus.set,
    primary: isMaster.primary,
    members: replStatus.members.map(m => ({ name: m.name, state: m.stateStr, health: m.health, pingMs: m.pingMs || 0 }))
  };

  // 2. CRUD Provision Performance Benchmark
  console.log('\n--- 2. CRUD OPERATIONS BENCHMARKING ---');
  
  // CREATE
  const cStart = process.hrtime.bigint();
  const testPolicy = new AccessPolicy({
    policyId: 'BENCH-POL-01',
    homeId: 'home_uk_01',
    credentialType: 'RFID_TAG',
    identifier: 'RFID-BENCH-999',
    holderName: 'Benchmark Test Resident',
    userRole: 'RESIDENT'
  });
  await testPolicy.save();
  const cDuration = Number(process.hrtime.bigint() - cStart) / 1e6;
  console.log(`✓ CRUD [CREATE]: ${cDuration.toFixed(2)} ms`);

  // READ
  const rStart = process.hrtime.bigint();
  const fetched = await AccessPolicy.findOne({ identifier: 'RFID-BENCH-999' }).lean();
  const rDuration = Number(process.hrtime.bigint() - rStart) / 1e6;
  console.log(`✓ CRUD [READ]:   ${rDuration.toFixed(2)} ms (Matched: ${fetched?.holderName})`);

  // UPDATE
  const uStart = process.hrtime.bigint();
  await AccessPolicy.updateOne(
    { identifier: 'RFID-BENCH-999' },
    { $set: { notes: 'Updated in benchmark evaluation', userRole: 'STAFF' } }
  );
  const uDuration = Number(process.hrtime.bigint() - uStart) / 1e6;
  console.log(`✓ CRUD [UPDATE]: ${uDuration.toFixed(2)} ms`);

  // DELETE
  const dStart = process.hrtime.bigint();
  await AccessPolicy.deleteOne({ identifier: 'RFID-BENCH-999' });
  const dDuration = Number(process.hrtime.bigint() - dStart) / 1e6;
  console.log(`✓ CRUD [DELETE]: ${dDuration.toFixed(2)} ms`);

  results.benchmarks.crud = {
    createMs: parseFloat(cDuration.toFixed(2)),
    readMs: parseFloat(rDuration.toFixed(2)),
    updateMs: parseFloat(uDuration.toFixed(2)),
    deleteMs: parseFloat(dDuration.toFixed(2))
  };

  // 3. Write Concern Latency Benchmark (w:1 vs w:majority)
  console.log('\n--- 3. DISTRIBUTED WRITE CONCERN EVALUATION ---');
  
  // Write Concern w:1
  const w1Start = process.hrtime.bigint();
  await GateEvent.create([{
    eventId: `BENCH-W1-${Date.now()}`,
    homeId: 'home_uk_01',
    gateId: 'gate_main_01',
    eventType: 'RFID_ENTRY_SUCCESS',
    sensorId: 'DEV-RFID-01',
    payload: { notes: 'Write Concern 1 test' }
  }], { writeConcern: { w: 1 } });
  const w1Duration = Number(process.hrtime.bigint() - w1Start) / 1e6;
  console.log(`Write Concern { w: 1 } (Primary-only acknowledgment): ${w1Duration.toFixed(2)} ms`);

  // Write Concern w:majority (Primary + Secondary replicated acknowledgment)
  const wMajStart = process.hrtime.bigint();
  await GateEvent.create([{
    eventId: `BENCH-WMAJ-${Date.now()}`,
    homeId: 'home_uk_01',
    gateId: 'gate_main_01',
    eventType: 'RFID_ENTRY_SUCCESS',
    sensorId: 'DEV-RFID-01',
    payload: { notes: 'Write Concern majority test' }
  }], { writeConcern: { w: 'majority', j: true } });
  const wMajDuration = Number(process.hrtime.bigint() - wMajStart) / 1e6;
  console.log(`Write Concern { w: 'majority', j: true } (Replicated & Journaled): ${wMajDuration.toFixed(2)} ms`);

  results.benchmarks.writeConcern = {
    w1Ms: parseFloat(w1Duration.toFixed(2)),
    wMajorityMs: parseFloat(wMajDuration.toFixed(2))
  };

  // 4. Aggregation Pipeline Performance
  console.log('\n--- 4. MONGODB AGGREGATION PIPELINE BENCHMARKS ---');
  
  const agg1Start = process.hrtime.bigint();
  const hourlyTraffic = await getHourlyTraffic('home_uk_01', 30);
  const agg1Duration = Number(process.hrtime.bigint() - agg1Start) / 1e6;
  console.log(`Hourly Traffic Aggregation Pipeline ($match, $project, $group, $sort): ${agg1Duration.toFixed(2)} ms`);

  const agg2Start = process.hrtime.bigint();
  const securityStats = await getSecurityAnalytics('home_uk_01', 30);
  const agg2Duration = Number(process.hrtime.bigint() - agg2Start) / 1e6;
  console.log(`Security Incident Multi-Facet Aggregation Pipeline: ${agg2Duration.toFixed(2)} ms (Total incidents: ${securityStats.totalSecurityIncidents})`);

  const agg3Start = process.hrtime.bigint();
  const motorHealth = await getMotorHealth('gate_main_01');
  const agg3Duration = Number(process.hrtime.bigint() - agg3Start) / 1e6;
  console.log(`Motor Health & Predictive Maintenance Pipeline: ${agg3Duration.toFixed(2)} ms (Score: ${motorHealth.healthScore}/100, Status: ${motorHealth.status})`);

  const agg4Start = process.hrtime.bigint();
  const sensorHealth = await getSensorHealthAnalytics('gate_main_01');
  const agg4Duration = Number(process.hrtime.bigint() - agg4Start) / 1e6;
  console.log(`3-Core Sensor Health Analytics Pipeline (Photocell, Limit Switch, RFID): ${agg4Duration.toFixed(2)} ms`);
  console.log(`  - Optical Signal Strength Avg: ${sensorHealth.photocell.avgOpticalSignalStrength}% (Status: ${sensorHealth.photocell.status})`);
  console.log(`  - Limit Switch Resting Confirmation: ${sensorHealth.limitSwitch.restingStateConfirmationRate} (Standby: ${sensorHealth.limitSwitch.avgStandbyPowerWatts}W)`);
  console.log(`  - RFID Background Noise Floor: ${sensorHealth.rfidReader.avgBackgroundNoiseDbm} dBm (Heartbeat: ${sensorHealth.rfidReader.heartbeatStatus})`);

  results.benchmarks.aggregations = {
    hourlyTrafficMs: parseFloat(agg1Duration.toFixed(2)),
    securityStatsMs: parseFloat(agg2Duration.toFixed(2)),
    motorHealthMs: parseFloat(agg3Duration.toFixed(2)),
    sensorHealthMs: parseFloat(agg4Duration.toFixed(2))
  };

  console.log('\n================================================================');
  console.log(' BENCHMARK EVALUATION COMPLETED SUCCESSFULLY');
  console.log(` Total Time Elapsed: ${Date.now() - startTime} ms`);
  console.log('================================================================');

  await mongoose.disconnect();
  return results;
}

runEvaluation()
  .then(res => {
    const fs = require('fs');
    fs.writeFileSync('./report/benchmark_results.json', JSON.stringify(res, null, 2));
    console.log('Benchmark metrics saved to ./report/benchmark_results.json');
  })
  .catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
  });
