const mongoose = require('mongoose');

const gateTelemetrySchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['IDLE_CLOSED', 'OPENING', 'OPEN', 'CLOSING', 'OBSTACLE_HOLD', 'LOCKED', 'FAULT'],
    required: true,
    default: 'IDLE_CLOSED'
  },
  
  // Optical safety beam
  photocell: {
    healthStatus: {
      type: String,
      enum: ['HEALTHY', 'DIRTY_LENS_WARNING', 'MISALIGNED', 'FAULT'],
      default: 'HEALTHY'
    },
    opticalSignalStrength: {
      type: Number,
      required: true,
      default: 95.0,
      min: 0,
      max: 100
    },
    beamContinuity: {
      type: Boolean,
      required: true,
      default: true
    }
  },

  // Mechanical limit switch & power telemetry
  limitSwitch: {
    restingState: {
      type: String,
      enum: ['FULLY_CLOSED', 'AJAR', 'FULLY_OPEN', 'FAULT'],
      required: true,
      default: 'FULLY_CLOSED'
    },
    ambientMotorTemperatureC: {
      type: Number,
      required: true,
      default: 21.5
    },
    standbyPowerWatts: {
      type: Number,
      required: true,
      default: 2.1
    }
  },

  // Proximity reader status
  rfidReader: {
    operationalHeartbeat: {
      type: Boolean,
      default: true
    },
    antennaStatus: {
      type: String,
      enum: ['TUNED', 'OPTIMAL', 'DETUNED', 'IMPEDANCE_MISMATCH'],
      default: 'OPTIMAL'
    },
    backgroundNoiseDbm: {
      type: Number,
      required: true,
      default: -82.0
    }
  },

  metrics: {
    obstacleDistanceCm: { type: Number, default: 250 },
    pirMotionDetected: { type: Boolean, default: false },
    reedSwitchState: { type: String, enum: ['CLOSED', 'AJAR', 'OPEN'], default: 'CLOSED' },
    motorCurrentAmps: { type: Number, default: 0.0 },
    motorTemperatureC: { type: Number, default: 21.5 },
    batteryBackupVoltage: { type: Number, default: 12.8 },
    ambientLightLux: { type: Number, default: 450 },
    tamperVibrationG: { type: Number, default: 0.02 }
  },

  lockEngaged: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'gate_telemetry'
});

gateTelemetrySchema.index({ gateId: 1, timestamp: -1 });
gateTelemetrySchema.index({ 'photocell.healthStatus': 1, timestamp: -1 });
gateTelemetrySchema.index({ 'limitSwitch.restingState': 1, timestamp: -1 });
gateTelemetrySchema.index({ 'rfidReader.antennaStatus': 1, timestamp: -1 });

// 30-day retention policy
gateTelemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('GateTelemetry', gateTelemetrySchema);
