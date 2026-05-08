const express = require('express');
const User = require('../models/User');
const Follow = require('../models/Follow');
const { verifyToken } = require('../middleware/auth');
const { rsaDecrypt } = require('../utils/kms');

const router = express.Router();

function createUserResponse(user) {
  return {
    id: user._id,
    username: rsaDecrypt(user.usernameEnc, user.usernameKeyVersion),
    email: rsaDecrypt(user.emailEnc, user.emailKeyVersion),
    role: user.role,
    emailVerified: user.emailVerified,
    profile: {
      displayName: user.profile.displayNameEnc
        ? rsaDecrypt(user.profile.displayNameEnc, user.profile.displayNameKeyVersion)
        : '',
      bio: user.profile.bioEnc ? rsaDecrypt(user.profile.bioEnc, user.profile.bioKeyVersion) : '',
      avatarUrl: user.profile.avatarUrl,
    },
  };
}

router.post('/:userId/follow', verifyToken, async (req, res) => {
  const { userId } = req.params;
  if (req.user.id === userId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  try {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existing = await Follow.findOne({ follower: req.user.id, following: userId });
    if (existing) {
      return res.status(409).json({ error: 'Already following' });
    }
    await Follow.create({ follower: req.user.id, following: userId });
    return res.status(201).json({ message: 'Following user' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:userId/unfollow', verifyToken, async (req, res) => {
  const { userId } = req.params;
  try {
    const follow = await Follow.findOne({ follower: req.user.id, following: userId });
    if (!follow) {
      return res.status(404).json({ error: 'Not following this user' });
    }
    await Follow.deleteOne({ _id: follow._id });
    return res.json({ message: 'Unfollowed user' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:userId/followers', async (req, res) => {
  const { userId } = req.params;
  try {
    const follows = await Follow.find({ following: userId }).populate('follower');
    const followers = follows.map((f) => createUserResponse(f.follower));
    return res.json({ followers, count: followers.length });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:userId/following', async (req, res) => {
  const { userId } = req.params;
  try {
    const follows = await Follow.find({ follower: userId }).populate('following');
    const following = follows.map((f) => createUserResponse(f.following));
    return res.json({ following, count: following.length });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:userId/is-following', verifyToken, async (req, res) => {
  const { userId } = req.params;
  try {
    const follow = await Follow.findOne({ follower: req.user.id, following: userId });
    return res.json({ isFollowing: !!follow });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
