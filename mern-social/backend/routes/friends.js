const express = require('express');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Friendship = require('../models/Friendship');
const { verifyToken } = require('../middleware/auth');
const { hashText, eccEncrypt, eccDecrypt, rsaDecrypt, verifyHmac } = require('../utils/kms');

const router = express.Router();

function buildFriendResponse(record) {
  const isFriendValid = verifyHmac(`${record.friendEnc}.${record.friendEphemeralPublicKey}`, record.friendMac);
  const isUsernameValid = verifyHmac(`${record.friendUsernameEnc}.${record.friendUsernameEphemeralPublicKey}`, record.friendUsernameMac);

  let friendUsername = 'unknown';
  if (isUsernameValid) {
    try {
      friendUsername = eccDecrypt({
        ciphertext: record.friendUsernameEnc,
        ephemeralPublicKey: record.friendUsernameEphemeralPublicKey,
        mac: record.friendUsernameMac,
      });
    } catch (e) {
      friendUsername = '[corrupted]';
    }
  }

  return {
    id: record.friend ? record.friend.toString() : 'unknown',
    username: friendUsername,
    integrityError: !isFriendValid || !isUsernameValid,
    createdAt: record.createdAt,
  };
}

async function createFriendshipPair(owner, friend) {
  const friendIdEncrypted = eccEncrypt(friend._id.toString());
  const friendUsernameEncrypted = eccEncrypt(rsaDecrypt(friend.usernameEnc, friend.usernameKeyVersion));

  const friendship = new Friendship({
    owner: owner._id,
    friend: friend._id,
    friendEnc: friendIdEncrypted.ciphertext,
    friendEphemeralPublicKey: friendIdEncrypted.ephemeralPublicKey,
    friendMac: friendIdEncrypted.mac,
    friendKeyVersion: friendIdEncrypted.keyVersion,
    friendUsernameEnc: friendUsernameEncrypted.ciphertext,
    friendUsernameEphemeralPublicKey: friendUsernameEncrypted.ephemeralPublicKey,
    friendUsernameMac: friendUsernameEncrypted.mac,
    friendUsernameKeyVersion: friendUsernameEncrypted.keyVersion,
  });

  await friendship.save();
}

router.post('/request', verifyToken, async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Target username is required' });
  }

  try {
    const targetHash = hashText(username);
    const targetUser = await User.findOne({ usernameHash: targetHash });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }
    if (targetUser._id.equals(req.user.id)) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const existingRequest = await FriendRequest.findOne({
      requester: req.user.id,
      requested: targetUser._id,
    });
    if (existingRequest) {
      return res.status(409).json({ error: 'Friend request already pending or completed' });
    }

    const reverseRequest = await FriendRequest.findOne({
      requester: targetUser._id,
      requested: req.user.id,
      status: 'pending',
    });
    if (reverseRequest) {
      reverseRequest.status = 'accepted';
      await reverseRequest.save();
      const requester = await User.findById(req.user.id);
      await createFriendshipPair(requester, targetUser);
      await createFriendshipPair(targetUser, requester);
      return res.json({ message: 'Friend request accepted automatically' });
    }

    await FriendRequest.create({ requester: req.user.id, requested: targetUser._id });
    return res.status(201).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error('[FRIEND REQUEST ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/requests', verifyToken, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ requested: req.user.id, status: 'pending' }).populate('requester');
    const result = requests.map((request) => ({
      id: request._id,
      username: rsaDecrypt(request.requester.usernameEnc, request.requester.usernameKeyVersion),
      requesterId: request.requester._id,
    }));
    return res.json({ requests: result });
  } catch (err) {
    console.error('[FRIEND REQUESTS ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/requests/:requestId/accept', verifyToken, async (req, res) => {
  try {
    const request = await FriendRequest.findOne({ _id: req.params.requestId, requested: req.user.id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    request.status = 'accepted';
    await request.save();

    const requester = await User.findById(request.requester);
    const requested = await User.findById(request.requested);
    await createFriendshipPair(requester, requested);
    await createFriendshipPair(requested, requester);

    return res.json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error('[FRIEND ACCEPT ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/requests/:requestId/reject', verifyToken, async (req, res) => {
  try {
    const request = await FriendRequest.findOne({ _id: req.params.requestId, requested: req.user.id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    request.status = 'rejected';
    await request.save();
    return res.json({ message: 'Friend request rejected' });
  } catch (err) {
    console.error('[FRIEND REJECT ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const friendships = await Friendship.find({ owner: req.user.id });
    const friends = friendships.map(buildFriendResponse);
    return res.json({ friends });
  } catch (err) {
    console.error('[FRIEND LIST ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:friendId', verifyToken, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    await Friendship.deleteOne({ owner: req.user.id, friend: friendId });
    await Friendship.deleteOne({ owner: friendId, friend: req.user.id });
    await FriendRequest.deleteOne({ requester: req.user.id, requested: friendId, status: 'accepted' });
    await FriendRequest.deleteOne({ requester: friendId, requested: req.user.id, status: 'accepted' });
    return res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error('[FRIEND REMOVE ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
