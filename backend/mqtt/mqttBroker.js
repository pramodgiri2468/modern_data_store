const { Aedes } = require('aedes');
const net = require('net');

const MQTT_PORT = process.env.MQTT_PORT || 1883;

let serverInstance = null;
let aedesInstance = null;

async function startBroker() {
  if (!aedesInstance) {
    aedesInstance = await Aedes.createBroker();
  }

  return new Promise((resolve) => {
    const server = net.createServer(aedesInstance.handle);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[MQTT Broker] Port ${MQTT_PORT} in use, connecting to existing MQTT broker.`);
      } else {
        console.error('[MQTT Broker] Server error:', err);
      }
      resolve(null);
    });

    server.listen(MQTT_PORT, '0.0.0.0', () => {
      console.log(`[MQTT Broker] Aedes MQTT broker running on tcp://127.0.0.1:${MQTT_PORT}`);
      serverInstance = server;
      resolve(server);
    });

    aedesInstance.on('client', (client) => {
      console.log(`[MQTT Broker] Client connected: ${client ? client.id : 'unknown'}`);
    });

    aedesInstance.on('clientDisconnect', (client) => {
      console.log(`[MQTT Broker] Client disconnected: ${client ? client.id : 'unknown'}`);
    });

    aedesInstance.on('clientError', (client, err) => {
      if (err.message && err.message.includes('protocol version')) {
        console.warn(`[MQTT Broker] ⚠️ Connection rejected for ${client ? client.id : 'client'}: Client attempted MQTT 5.0. Set 'MQTT Version' to '3.1.1' in MQTTX!`);
      } else {
        console.warn(`[MQTT Broker] Client error (${client ? client.id : 'unknown'}):`, err.message);
      }
    });

    aedesInstance.on('connectionError', (client, err) => {
      console.warn(`[MQTT Broker] Connection error (${client ? client.id : 'unknown'}):`, err.message);
    });

    aedesInstance.on('publish', (packet, client) => {
      if (client && !packet.topic.includes('/telemetry')) {
        console.log(`[MQTT Broker] [${packet.topic}] from ${client.id}: ${packet.payload.toString().substring(0, 100)}`);
      }
    });
  });
}

function stopBroker() {
  if (serverInstance) {
    serverInstance.close();
  }
  if (aedesInstance) {
    aedesInstance.close();
  }
}

module.exports = {
  startBroker,
  stopBroker,
  getAedes: () => aedesInstance
};
