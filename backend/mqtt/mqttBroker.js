const { Aedes } = require('aedes');
const net = require('net');

const MQTT_PORT = parseInt(process.env.MQTT_PORT, 10) || 1883;

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
        console.warn(`[mqtt:broker] Port ${MQTT_PORT} is in use; attaching to existing broker`);
      } else {
        console.error('[mqtt:broker] Server error:', err.message);
      }
      resolve(null);
    });

    server.listen(MQTT_PORT, '0.0.0.0', () => {
      console.log(`[mqtt:broker] Running on tcp://127.0.0.1:${MQTT_PORT}`);
      serverInstance = server;
      resolve(server);
    });

    aedesInstance.on('client', (client) => {
      const id = client ? client.id : 'anonymous';
      console.log(`[mqtt:broker] Client connected: ${id}`);
    });

    aedesInstance.on('clientDisconnect', (client) => {
      const id = client ? client.id : 'anonymous';
      console.log(`[mqtt:broker] Client disconnected: ${id}`);
    });

    aedesInstance.on('clientError', (client, err) => {
      const id = client ? client.id : 'anonymous';
      if (err.message && err.message.includes('protocol version')) {
        console.warn(`[mqtt:broker] Protocol version rejected for ${id}. Clients must connect via MQTT 3.1.1.`);
      } else {
        console.warn(`[mqtt:broker] Client error (${id}): ${err.message}`);
      }
    });

    aedesInstance.on('connectionError', (client, err) => {
      const id = client ? client.id : 'anonymous';
      console.warn(`[mqtt:broker] Connection error (${id}): ${err.message}`);
    });

    aedesInstance.on('publish', (packet, client) => {
      if (client && !packet.topic.includes('/telemetry')) {
        console.log(`[mqtt:broker] ${packet.topic} (${client.id}): ${packet.payload.toString().substring(0, 80)}`);
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
