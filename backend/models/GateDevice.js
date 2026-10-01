const mongoose = require('mongoose');

const gateDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  homeId: {
    type: String,
    required: true,
    default: 'home_uk_01'
  },
  gateId: {
    type: String,
    required: true,
    default: 'gate_main_01'
  },
  name: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    required: true,
    enum: [
      'GATE_CONTROLLER_MASTER',
      'SAFETY_PHOTOCELL_BEAM',
      'MECHANICAL_LIMIT_SWITCH',
      'ULTRASONIC_SAFETY_BEAM',
      'PIR_MOTION_DETECTOR',
      'RFID_CARD_READER',
      'ALPR_CAMERA_NODE',
      'SOLENOID_SMART_LOCK',
      'TAMPER_ACCELEROMETER',
      'POWER_BACKUP_UPS'
    ]
  },
  firmwareVersion: {
    type: String,
    default: 'v2.4.1'
  },
  macAddress: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    default: '192.168.1.100'
  },
  status: {
    type: String,
    enum: ['ONLINE', 'DEGRADED', 'OFFLINE'],
    default: 'ONLINE'
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  totalCyclesOperated: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'gate_devices'
});

module.exports = mongoose.model('GateDevice', gateDeviceSchema);
