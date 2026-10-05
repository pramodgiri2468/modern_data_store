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

const PORT = parseInt(process.env.PORT, 10) || 3000;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';

// Core middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path === '/favicon.ico') {
    return next();
  }
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[http] ${req.method} ${req.originalUrl || req.url} ${status} - ${duration}ms`);
  });
  next();
});

// Static assets
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/gate', gateRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cluster', clusterRoutes);
app.use('/api/notifications', notificationRoutes);

// Server-Sent Events stream for real-time dashboard updates
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'INIT_STATE', payload: getGateState() })}\n\n`);

  const unregister = registerStateListener((newState) => {
    res.write(`data: ${JSON.stringify({ type: 'GATE_UPDATE', payload: newState })}\n\n`);
  });

  req.on('close', () => {
    unregister();
    res.end();
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'IoThings Smart House Main Gate Automation Controller',
    timestamp: new Date()
  });
});

// Frontend fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Clear any orphaned process holding our ports during development reloads
function cleanupOccupiedPorts() {
  try {
    const { execSync } = require('child_process');
    const myPid = process.pid.toString();
    const ports = [PORT, 1883];
    const output = execSync(`lsof -ti:${ports.join(',')} -sTCP:LISTEN 2>/dev/null || true`).toString().trim();
    if (output) {
      const pids = output.split('\n').map(p => p.trim()).filter(p => p && p !== myPid);
      if (pids.length > 0) {
        console.log(`[server] Freeing port(s) ${ports.join(', ')} from PID(s): ${pids.join(', ')}`);
        execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`);
        execSync('sleep 0.3 2>/dev/null || true');
      }
    }
  } catch {
    // Non-fatal if lsof or kill fails
  }
}

async function startServer() {
  console.log('[server] Initializing IoThings Gate Controller...');
  cleanupOccupiedPorts();

  await connectDB();
  await startBroker();
  initMqttClient(MQTT_BROKER_URL);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${PORT} is already in use by another process.`);
    } else {
      console.error('[server] Startup error:', err);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`[server] Web dashboard and REST API listening at http://localhost:${PORT}`);
    console.log(`[mqtt] Embedded broker listening on tcp://127.0.0.1:1883`);

    const intervalMs = parseInt(process.env.TELEMETRY_INTERVAL_MS, 10) || 15000;
    if (process.env.AUTO_EMIT_TELEMETRY !== 'false') {
      const { emitSensorTelemetry } = require('./services/telemetryEmitter');
      console.log(`[telemetry] Background sensor stream scheduled every ${intervalMs / 1000}s`);
      setTimeout(() => emitSensorTelemetry().catch(() => {}), 1500);
      setInterval(() => emitSensorTelemetry().catch(() => {}), intervalMs);
    }
  });
}

function handleShutdown() {
  console.log('\n[server] Shutting down gracefully...');
  stopBroker();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

startServer();

module.exports = { app, server };
