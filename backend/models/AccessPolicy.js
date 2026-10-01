const mongoose = require('mongoose');

const accessPolicySchema = new mongoose.Schema({
  policyId: {
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
  credentialType: {
    type: String,
    required: true,
    enum: ['RFID_TAG', 'LICENSE_PLATE', 'PIN_CODE', 'TEMPORARY_PASS'],
    index: true
  },
  identifier: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  holderName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['RESIDENT', 'FAMILY', 'STAFF', 'DELIVERY', 'GUEST', 'SERVICE_TECH'],
    default: 'RESIDENT'
  },
  schedule: {
    is24x7: { type: Boolean, default: true },
    allowedDays: {
      type: [Number], // 0: Sun, 1: Mon, ..., 6: Sat
      default: [0, 1, 2, 3, 4, 5, 6]
    },
    timeStart: { type: String, default: '00:00' }, // HH:mm
    timeEnd: { type: String, default: '23:59' }    // HH:mm
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  validUntil: {
    type: Date,
    default: null
  },
  notificationEmail: {
    type: String,
    default: '',
    trim: true
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'access_policies'
});

accessPolicySchema.index({ homeId: 1, credentialType: 1, isActive: 1 });

module.exports = mongoose.model('AccessPolicy', accessPolicySchema);
