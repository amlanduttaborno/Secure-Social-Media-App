const express = require('express');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { rsaEncrypt, rsaDecrypt, verifyHmac } = require('../utils/kms');

const router = express.Router();

function createUserResponse(user) {
  const username = verifyHmac(user.usernameEnc, user.usernameMac) ? rsaDecrypt(user.usernameEnc, user.usernameKeyVersion || undefined) : '';
  const email = verifyHmac(user.emailEnc, user.emailMac) ? rsaDecrypt(user.emailEnc, user.emailKeyVersion || undefined) : '';
  const phone = user.phoneEnc && user.phoneMac && verifyHmac(user.phoneEnc, user.phoneMac)
    ? rsaDecrypt(user.phoneEnc, user.phoneKeyVersion || undefined)
    : '';
  const displayName = user.profile.displayNameEnc && user.profile.displayNameMac && verifyHmac(user.profile.displayNameEnc, user.profile.displayNameMac)
    ? rsaDecrypt(user.profile.displayNameEnc, user.profile.displayNameKeyVersion || undefined)
    : '';
  const bio = user.profile.bioEnc && user.profile.bioMac && verifyHmac(user.profile.bioEnc, user.profile.bioMac)
    ? rsaDecrypt(user.profile.bioEnc, user.profile.bioKeyVersion || undefined)
    : '';

  return {
    id: user._id,
    username,
    email,
    phone,
    role: user.role,
    emailVerified: user.emailVerified,
    profile: {
      displayName,
      bio,
      avatarUrl: user.profile.avatarUrl,
    },
  };
}

router.get('/profile', verifyToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user: createUserResponse(user) });
});

router.put('/profile', verifyToken, async (req, res) => {
  const { displayName, bio, avatarUrl, phone } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (displayName !== undefined) {
    const encrypted = rsaEncrypt(displayName || '');
    user.profile.displayNameEnc = encrypted.ciphertext;
    user.profile.displayNameMac = encrypted.mac;
    user.profile.displayNameKeyVersion = encrypted.keyVersion;
  }
  if (bio !== undefined) {
    const encrypted = rsaEncrypt(bio || '');
    user.profile.bioEnc = encrypted.ciphertext;
    user.profile.bioMac = encrypted.mac;
    user.profile.bioKeyVersion = encrypted.keyVersion;
  }
  if (avatarUrl !== undefined) {
    user.profile.avatarUrl = avatarUrl;
  }
  if (phone !== undefined) {
    const encrypted = rsaEncrypt(phone || '');
    user.phoneEnc = encrypted.ciphertext;
    user.phoneMac = encrypted.mac;
    user.phoneKeyVersion = encrypted.keyVersion;
  }
  await user.save();
  return res.json({ user: createUserResponse(user) });
});

module.exports = router;
