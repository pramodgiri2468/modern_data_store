const mongoose = require('mongoose');

const gateEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  homeId: {
    type: String,
    required: true,
    default: 'home_uk_01',
    index: true
  },
  gateId: {
    type: String,
    required: true,
    default: 'gate_main_01',
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'RFID_ENTRY_SUCCESS',
      'RFID_ENTRY_DENIED',
      'ALPR_ENTRY_SUCCESS',
      'ALPR_ENTRY_DENIED',
      'MANUAL_REMOTE_OPEN',
      'MANUAL_REMOTE_CLOSE',
      'AUTO_CLOSE_TRIGGERED',
      'SAFETY_OBSTACLE_DETECTED',
      'SAFETY_REVERSE_TRIGGERED',
      'PHOTOCELL_LENS_DIRTY_WARNING',
      'PHOTOCELL_BEAM_BROKEN',
      'LIMIT_SWITCH_CONFIRMED_RESTING',
      'LIMIT_SWITCH_FAULT',
      'RFID_ANTENNA_DETUNED_WARNING',
      'RFID_NOISE_FLOOR_EXCEEDED',
      'TAMPER_ALARM',
      'INTRUSION_DETECTED',
      'UNAUTHORIZED_ENTRY',
      'GATE_FORCE_ATTEMPT',
      'LOCK_ENGAGED',
      'LOCK_RELEASED',
      'MOTOR_OVERCURRENT_WARNING',
      'BATTERY_BACKUP_ACTIVE',
      'MAINTENANCE_REQUIRED'
    ],
    index: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARN', 'CRITICAL'],
    default: 'INFO',
    index: true
  },
  sensorId: {
    type: String,
    required: true
  },
  source: {
    type: String,
    enum: ['MQTT_TELEMETRY', 'REST_API', 'MANUAL_OVERRIDE', 'AUTOMATED_SAFETY', 'SENSOR_TELEMETRY_PIPELINE'],
    default: 'MQTT_TELEMETRY'
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'gate_events'
});

// Compound indexes for high performance query resolution
gateEventSchema.index({ homeId: 1, timestamp: -1 });
gateEventSchema.index({ eventType: 1, timestamp: -1 });
gateEventSchema.index({ severity: 1, timestamp: -1 });

module.exports = mongoose.model('GateEvent', gateEventSchema);
