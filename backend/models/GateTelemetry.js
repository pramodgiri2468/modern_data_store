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
  
  // 1. Photocell Sensor: Safety beam monitoring
  photocell: {
    healthStatus: {
      type: String,
      enum: ['HEALTHY', 'DIRTY_LENS_WARNING', 'MISALIGNED', 'FAULT'],
      default: 'HEALTHY'
    },
    opticalSignalStrength: {
      type: Number, // Percentage: 0 - 100% (checking for dirty lenses or physical misalignment)
      required: true,
      default: 95.0,
      min: 0,
      max: 100
    },
    beamContinuity: {
      type: Boolean, // true = CONTINUOUS (path clear), false = OBSTRUCTED (path broken)
      required: true,
      default: true
    }
  },

  // 2. Limit Switch Sensor: Mechanical boundary & power tracking
  limitSwitch: {
    restingState: {
      type: String,
      enum: ['FULLY_CLOSED', 'AJAR', 'FULLY_OPEN', 'FAULT'],
      required: true,
      default: 'FULLY_CLOSED'
    },
    ambientMotorTemperatureC: {
      type: Number, // Ambient motor temperature in °C
      required: true,
      default: 21.5
    },
    standbyPowerWatts: {
      type: Number, // Standby electrical power usage in Watts (e.g. 1.8W - 3.2W)
      required: true,
      default: 2.1
    }
  },

  // 3. RFID Reader Sensor: Proximity access control health
  rfidReader: {
    operationalHeartbeat: {
      type: Boolean, // Confirmation of regular operational heartbeat pulse
      default: true
    },
    antennaStatus: {
      type: String,
      enum: ['TUNED', 'OPTIMAL', 'DETUNED', 'IMPEDANCE_MISMATCH'],
      default: 'OPTIMAL'
    },
    backgroundNoiseDbm: {
      type: Number, // Background RF electromagnetic noise floor in dBm (e.g. -85 dBm to -55 dBm)
      required: true,
      default: -82.0
    }
  },

  // Backward compatibility & environmental metrics
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

// Compound index for high-velocity query resolution
gateTelemetrySchema.index({ gateId: 1, timestamp: -1 });

// Secondary indexes for the 3 core sensor metrics
gateTelemetrySchema.index({ 'photocell.healthStatus': 1, timestamp: -1 });
gateTelemetrySchema.index({ 'limitSwitch.restingState': 1, timestamp: -1 });
gateTelemetrySchema.index({ 'rfidReader.antennaStatus': 1, timestamp: -1 });

// TTL index to automatically purge raw telemetry after 30 days (2,592,000 seconds)
gateTelemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('GateTelemetry', gateTelemetrySchema);
