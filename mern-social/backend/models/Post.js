const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titleEnc: { type: String, required: true },
  titleMac: { type: String, required: true },
  titleKeyVersion: { type: Number, required: true, default: 1 },
  bodyEnc: { type: String, required: true },
  bodyMac: { type: String, required: true },
  bodyKeyVersion: { type: Number, required: true, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Post', postSchema);
