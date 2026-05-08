const express = require('express');
const Message = require('../models/Message');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { rsaEncrypt, rsaDecrypt, verifyHmac, hashPin } = require('../utils/kms');

const router = express.Router();

async function validateFriendship(userId, friendId) {
  const friendship = await Friendship.findOne({ owner: userId, friend: friendId });
  return !!friendship;
}

router.post('/', verifyToken, async (req, res) => {
  const { friendId, message } = req.body;
  if (!friendId || !message) {
    return res.status(400).json({ error: 'friendId and message are required' });
  }

  try {
    const allowed = await validateFriendship(req.user.id, friendId);
    if (!allowed) {
      return res.status(403).json({ error: 'Can only send messages to friends' });
    }

    const encrypted = rsaEncrypt(message);
    await Message.create({
      sender: req.user.id,
      receiver: friendId,
      messageEnc: encrypted.ciphertext,
      messageMac: encrypted.mac,
      messageKeyVersion: encrypted.keyVersion,
    });
    return res.status(201).json({ message: 'Message sent' });
  } catch (err) {
    console.error('[MESSAGE SEND ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/conversation/:friendId', verifyToken, async (req, res) => {
  const { friendId } = req.params;
  try {
    const allowed = await validateFriendship(req.user.id, friendId);
    if (!allowed) {
      return res.status(403).json({ error: 'Conversation unavailable' });
    }
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: friendId },
        { sender: friendId, receiver: req.user.id },
      ],
    }).sort({ createdAt: 1 });

    const summary = messages.map((msg) => ({
      id: msg._id,
      sender: msg.sender,
      receiver: msg.receiver,
      createdAt: msg.createdAt,
    }));
    return res.json({ conversation: summary });
  } catch (err) {
    console.error('[MESSAGE LIST ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/restore', verifyToken, async (req, res) => {
  const { friendId, pin } = req.body;
  if (!friendId || !pin) {
    return res.status(400).json({ error: 'friendId and recovery PIN are required' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.recoveryPinHash || !user.recoveryPinSalt) {
      return res.status(403).json({ error: 'Recovery PIN not configured' });
    }

    const providedHash = hashPin(pin, user.recoveryPinSalt);
    if (providedHash !== user.recoveryPinHash) {
      return res.status(401).json({ error: 'Invalid recovery PIN' });
    }

    const allowed = await validateFriendship(req.user.id, friendId);
    if (!allowed) {
      return res.status(403).json({ error: 'Conversation unavailable' });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: friendId },
        { sender: friendId, receiver: req.user.id },
      ],
    }).sort({ createdAt: 1 });

    const decrypted = messages.map((msg) => ({
      id: msg._id,
      sender: msg.sender,
      receiver: msg.receiver,
      createdAt: msg.createdAt,
      text: verifyHmac(msg.messageEnc, msg.messageMac) ? rsaDecrypt(msg.messageEnc, msg.messageKeyVersion) : '[corrupted]'
    }));

    return res.json({ conversation: decrypted });
  } catch (err) {
    console.error('[MESSAGE RESTORE ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
