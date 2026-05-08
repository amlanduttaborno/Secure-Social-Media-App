const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  ciphertext: { type: String, required: true },
  ephemeralPublicKey: { type: String, required: true },
  mac: { type: String, required: true },
  keyVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});

module.exports = mongoose.model('Otp', otpSchema);
