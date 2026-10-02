#!/usr/bin/env node
require('dotenv').config();
const mqtt = require('mqtt');

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const topic = process.argv[2] || 'iothings/#';

console.log(`Subscribing to "${topic}" on ${brokerUrl}`);
console.log('Press Ctrl+C to exit\n');

const client = mqtt.connect(brokerUrl, {
  clientId: `sub_${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 2000
});

client.on('connect', () => {
  client.subscribe(topic, (err) => {
    if (err) {
      console.error('Subscription error:', err.message);
    } else {
      console.log(`Connected and subscribed to ${topic}\n`);
    }
  });
});

client.on('message', (receivedTopic, message) => {
  const time = new Date().toLocaleTimeString();
  let payload;
  try {
    payload = JSON.parse(message.toString());
  } catch {
    payload = message.toString();
  }

  console.log(`[${time}] ${receivedTopic}`);
  if (typeof payload === 'object') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(payload);
  }
  console.log('');
});

client.on('error', (err) => {
  console.error('MQTT client error:', err.message);
});

process.on('SIGINT', () => {
  console.log('\nExiting subscriber...');
  client.end(true, () => process.exit(0));
});

