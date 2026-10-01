const mongoose = require('mongoose');

const REPLICA_SET_URI = process.env.MONGO_URI || 
  'mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/iothings_gate?replicaSet=rs0&readPreference=primaryPreferred';

const STANDALONE_URI = 'mongodb://127.0.0.1:27017/iothings_gate';

let isConnected = false;
let activeUri = '';

async function connectDB() {
  const options = {
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 2000,
    connectTimeoutMS: 10000,
  };

  try {
    console.log(`[DB] Attempting connection to MongoDB 3-Node Replica Set: ${REPLICA_SET_URI}`);
    await mongoose.connect(REPLICA_SET_URI, options);
    isConnected = true;
    activeUri = REPLICA_SET_URI;
    console.log(`[DB] Connected successfully to MongoDB Replica Set (rs0)!`);
  } catch (err) {
    console.warn(`[DB] Replica Set connection failed (${err.message}). Trying standalone fallback...`);
    try {
      await mongoose.connect(STANDALONE_URI, options);
      isConnected = true;
      activeUri = STANDALONE_URI;
      console.log(`[DB] Connected successfully to standalone MongoDB on ${STANDALONE_URI}`);
    } catch (fallbackErr) {
      console.error(`[DB] All MongoDB connections failed: ${fallbackErr.message}`);
      isConnected = false;
    }
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected!');
    isConnected = false;
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected.');
    isConnected = true;
  });

  return isConnected;
}

async function getClusterStatus() {
  if (!isConnected) {
    return {
      status: 'DISCONNECTED',
      replicaSet: 'rs0',
      connected: false,
      members: []
    };
  }

  try {
    const adminDb = mongoose.connection.db.admin();
    const replStatus = await adminDb.command({ replSetGetStatus: 1 });
    const isMaster = await adminDb.command({ isMaster: 1 });

    const members = (replStatus.members || []).map(m => ({
      id: m._id,
      name: m.name,
      state: m.stateStr,
      health: m.health,
      uptime: m.uptime,
      pingMs: m.pingMs || 0,
      lastHeartbeat: m.lastHeartbeat,
      optimeDate: m.optimeDate,
      syncSourceHost: m.syncSourceHost || 'N/A'
    }));

    return {
      status: 'ONLINE',
      replicaSet: replStatus.set,
      primary: isMaster.primary || members.find(m => m.state === 'PRIMARY')?.name || 'None',
      hosts: isMaster.hosts || [],
      electionTime: replStatus.date,
      members: members
    };
  } catch (err) {
    // If running in standalone mode without replSet
    return {
      status: 'STANDALONE_MODE',
      replicaSet: null,
      primary: '127.0.0.1:27017',
      error: err.message,
      members: [
        { id: 0, name: '127.0.0.1:27017', state: 'STANDALONE', health: 1 }
      ]
    };
  }
}

module.exports = {
  connectDB,
  getClusterStatus,
  getIsConnected: () => isConnected,
  getActiveUri: () => activeUri
};
