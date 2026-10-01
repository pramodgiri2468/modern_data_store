require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const { connectDB } = require('./config/database');
const { startBroker, stopBroker } = require('./mqtt/mqttBroker');
const { initMqttClient, registerStateListener, getGateState } = require('./mqtt/mqttHandler');

const gateRoutes = require('./routes/gateRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const policyRoutes = require('./routes/policyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const clusterRoutes = require('./routes/clusterRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logger Middleware (shows every API hit in terminal)
app.use((req, res, next) => {
  if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path === '/favicon.ico') {
    return next();
  }
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const symbol = res.statusCode >= 400 ? '❌' : '✓';
    console.log(`[HTTP API] ${symbol} ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/gate', gateRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cluster', clusterRoutes);
app.use('/api/notifications', notificationRoutes);

// Server-Sent Events (SSE) endpoint for real-time push to web dashboard
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial state immediately
  res.write(`data: ${JSON.stringify({ type: 'INIT_STATE', payload: getGateState() })}\n\n`);

  const unregister = registerStateListener((newState) => {
    res.write(`data: ${JSON.stringify({ type: 'GATE_UPDATE', payload: newState })}\n\n`);
  });

  req.on('close', () => {
    unregister();
    res.end();
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'IoThings Smart House Main Gate Automation Controller',
    timestamp: new Date()
  });
});

// Catch-all route to serve SPA frontend
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Helper to free ports if an orphaned instance is still listening
function ensurePortsFree() {
  try {
    const { execSync } = require('child_process');
    const myPid = process.pid.toString();
    const ports = [PORT, 1883];
    const output = execSync(`lsof -ti:${ports.join(',')} -sTCP:LISTEN 2>/dev/null || true`).toString().trim();
    if (output) {
      const pids = output.split('\n').map(p => p.trim()).filter(p => p && p !== myPid);
      if (pids.length > 0) {
        console.log(`[Port Manager] Freeing occupied port(s) ${ports.join(', ')} from PID(s): ${pids.join(', ')}...`);
        execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`);
        const waitTill = Date.now() + 300;
        while (Date.now() < waitTill) {}
      }
    }
  } catch (err) {
    // Non-fatal fallback
  }
}

// Startup sequence
async function startServer() {
  console.log('====================================================');
  console.log(' IoThings Home Automation Solutions - Main Gate Core');
  console.log('====================================================');

  // 0. Ensure ports 3000 and 1883 are free
  ensurePortsFree();

  // 1. Connect to MongoDB Replica Set
  await connectDB();

  // 2. Start Embedded MQTT Broker
  await startBroker();

  // 3. Connect internal MQTT Client to broker
  initMqttClient(MQTT_BROKER_URL);

  // 4. Start HTTP Server
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [PORT CONFLICT] Port ${PORT} is already in use by another running instance.`);
      try {
        const { execSync } = require('child_process');
        const pids = execSync(`lsof -ti :${PORT} -sTCP:LISTEN 2>/dev/null || true`).toString().trim();
        if (pids) {
          console.error(`👉 Listening PID(s): ${pids.replace(/\n/g, ', ')}`);
          console.error(`👉 Run 'npm run server:stop' or 'kill -9 ${pids.replace(/\n/g, ' ')}' to terminate.\n`);
        }
      } catch (e) {
        console.error(`👉 Run 'npm run server:stop' to free port ${PORT}, then run 'npm start' again.\n`);
      }
    } else {
      console.error('[HTTP Server Error]', err);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`[HTTP Server] REST API and Web Dashboard live at: http://localhost:${PORT}`);
    console.log(`[MQTT] Broker listening on tcp://127.0.0.1:1883`);

    // 5. Automated real-time sensor telemetry stream (15s cadence)
    const TELEMETRY_INTERVAL_MS = parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000;
    if (process.env.AUTO_EMIT_TELEMETRY !== 'false') {
      const { emitSensorTelemetry } = require('./services/telemetryEmitter');
      console.log(`[Telemetry Engine] 📡 Emitting continuous sensor telemetry every ${TELEMETRY_INTERVAL_MS / 1000} seconds (${TELEMETRY_INTERVAL_MS} ms) to MongoDB & MQTT.`);
      setTimeout(() => emitSensorTelemetry().catch(() => {}), 1500);
      setInterval(() => emitSensorTelemetry().catch(() => {}), TELEMETRY_INTERVAL_MS);
    }

    console.log('====================================================');
  });
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n[Server] Gracefully shutting down...');
  stopBroker();
  process.exit(0);
});

startServer();

module.exports = { app, server };
