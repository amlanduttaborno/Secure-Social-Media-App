const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  usernameHash: { type: String, required: true, unique: true },
  usernameEnc: { type: String, required: true },
  usernameMac: { type: String },
  usernameKeyVersion: { type: Number, default: 1 },
  emailEnc: { type: String, required: true },
  emailMac: { type: String },
  emailKeyVersion: { type: Number, default: 1 },
  phoneEnc: { type: String, default: '' },
  phoneMac: { type: String, default: '' },
  phoneKeyVersion: { type: Number, default: 1 },
  recoveryPinHash: { type: String, default: '' },
  recoveryPinSalt: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  emailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  profile: {
    displayNameEnc: { type: String, default: '' },
    displayNameMac: { type: String, default: '' },
    displayNameKeyVersion: { type: Number, default: 1 },
    bioEnc: { type: String, default: '' },
    bioMac: { type: String, default: '' },
    bioKeyVersion: { type: Number, default: 1 },
    avatarUrl: { type: String, default: '' },
  },
});

module.exports = mongoose.model('User', userSchema);
