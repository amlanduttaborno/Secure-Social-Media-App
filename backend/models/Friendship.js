const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  friendEnc: { type: String, required: true },
  friendEphemeralPublicKey: { type: String, required: true },
  friendMac: { type: String, required: true },
  friendKeyVersion: { type: Number, required: true, default: 1 },
  friendUsernameEnc: { type: String, required: true },
  friendUsernameEphemeralPublicKey: { type: String, required: true },
  friendUsernameMac: { type: String, required: true },
  friendUsernameKeyVersion: { type: Number, required: true, default: 1 },
  createdAt: { type: Date, default: Date.now },
});

friendshipSchema.index({ owner: 1, friend: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);
