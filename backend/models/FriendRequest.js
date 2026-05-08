const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requested: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

friendRequestSchema.index({ requester: 1, requested: 1 }, { unique: true });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
