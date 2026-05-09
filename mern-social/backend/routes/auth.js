const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
  rsaEncrypt,
  rsaDecrypt,
  safeRsaDecrypt,
  eccEncrypt,
  eccDecrypt,
  hashText,
  hashPin,
  createSalt,
  rotateKeys,
  verifyHmac,
} = require('../utils/kms');
const { sendOtpEmail, isSmtpConfigured } = require('../utils/email');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 2,
};

function createUserResponse(user) {
  const username = safeRsaDecrypt(user.usernameEnc, user.usernameMac, user.usernameKeyVersion || undefined);
  const email = safeRsaDecrypt(user.emailEnc, user.emailMac, user.emailKeyVersion || undefined);
  if (!username || !email) {
    throw new Error('User integrity validation failed');
  }

  const phone = user.phoneEnc
    ? safeRsaDecrypt(user.phoneEnc, user.phoneMac, user.phoneKeyVersion || undefined)
    : '';

  const displayName = user.profile.displayNameEnc
    ? safeRsaDecrypt(user.profile.displayNameEnc, user.profile.displayNameMac, user.profile.displayNameKeyVersion || undefined)
    : '';

  const bio = user.profile.bioEnc
    ? safeRsaDecrypt(user.profile.bioEnc, user.profile.bioMac, user.profile.bioKeyVersion || undefined)
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

router.post('/register', async (req, res) => {
  const { username, email, phone, password, recoveryPin } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  try {
    const usernameHash = hashText(username);
    const existing = await User.findOne({ usernameHash });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(password, salt);
    const recoveryPinSalt = recoveryPin ? createSalt() : '';
    const recoveryPinHash = recoveryPin ? hashPin(recoveryPin, recoveryPinSalt) : '';
    const usernameEncrypted = rsaEncrypt(username);
    const emailEncrypted = rsaEncrypt(email);
    const phoneEncrypted = rsaEncrypt(phone || '');
    const displayNameEncrypted = rsaEncrypt(username);
    const bioEncrypted = rsaEncrypt('');
    const user = await User.create({
      usernameHash,
      usernameEnc: usernameEncrypted.ciphertext,
      usernameMac: usernameEncrypted.mac,
      usernameKeyVersion: usernameEncrypted.keyVersion,
      emailEnc: emailEncrypted.ciphertext,
      emailMac: emailEncrypted.mac,
      emailKeyVersion: emailEncrypted.keyVersion,
      phoneEnc: phoneEncrypted.ciphertext,
      phoneMac: phoneEncrypted.mac,
      phoneKeyVersion: phoneEncrypted.keyVersion,
      recoveryPinHash,
      recoveryPinSalt,
      passwordHash,
      profile: {
        displayNameEnc: displayNameEncrypted.ciphertext,
        displayNameMac: displayNameEncrypted.mac,
        displayNameKeyVersion: displayNameEncrypted.keyVersion,
        bioEnc: bioEncrypted.ciphertext,
        bioMac: bioEncrypted.mac,
        bioKeyVersion: bioEncrypted.keyVersion,
        avatarUrl: '',
      },
    });

    return res.status(201).json({ message: 'Registration successful', user: createUserResponse(user) });
  } catch (err) {
    console.error('[AUTH REGISTER ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const usernameHash = hashText(username);
    const user = await User.findOne({ usernameHash });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const encrypted = eccEncrypt(otpCode);
    await Otp.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        ciphertext: encrypted.ciphertext,
        ephemeralPublicKey: encrypted.ephemeralPublicKey,
        mac: encrypted.mac,
        keyVersion: encrypted.keyVersion,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      { upsert: true, new: true }
    );

    const email = safeRsaDecrypt(user.emailEnc, user.emailMac, user.emailKeyVersion);
    const emailResult = await sendOtpEmail(email, otpCode);
    const message = emailResult.sent
      ? 'A verification code has been sent to your registered email.'
      : emailResult.configured
        ? 'Failed to deliver OTP by email; check SMTP settings. OTP was logged locally for testing.'
        : 'SMTP is not configured; OTP was logged locally for testing.';
    const pendingUsername = safeRsaDecrypt(user.usernameEnc, user.usernameMac, user.usernameKeyVersion);
    return res.json({ pending: true, message, username: pendingUsername });
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/verify', async (req, res) => {
  const { username, otp } = req.body;
  if (!username || !otp) {
    return res.status(400).json({ error: 'Username and OTP are required' });
  }
  try {
    const usernameHash = hashText(username);
    const user = await User.findOne({ usernameHash });
    if (!user) {
      return res.status(401).json({ error: 'Invalid verification details' });
    }

    const otpRecord = await Otp.findOne({ user: user._id });
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: 'OTP expired or missing' });
    }

    const decryptedOtp = eccDecrypt({
      ciphertext: otpRecord.ciphertext,
      ephemeralPublicKey: otpRecord.ephemeralPublicKey,
      mac: otpRecord.mac,
    });

    if (decryptedOtp !== otp) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    await Otp.deleteOne({ user: user._id });
    user.emailVerified = true;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, username: safeRsaDecrypt(user.usernameEnc, user.usernameMac, user.usernameKeyVersion) },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.cookie('token', token, COOKIE_OPTIONS);
    return res.json({ message: 'Verification successful', user: createUserResponse(user) });
  } catch (err) {
    console.error('[AUTH VERIFY ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/recovery-pin', verifyToken, async (req, res) => {
  const { recoveryPin } = req.body;
  if (!recoveryPin) {
    return res.status(400).json({ error: 'Recovery PIN is required' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const salt = createSalt();
    user.recoveryPinSalt = salt;
    user.recoveryPinHash = hashPin(recoveryPin, salt);
    await user.save();
    return res.json({ message: 'Recovery PIN configured successfully' });
  } catch (err) {
    console.error('[RECOVERY PIN ERROR]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/rotate-keys', verifyToken, requireAdmin, async (req, res) => {
  try {
    const metadata = rotateKeys();
    return res.json({ message: 'Key store rotated successfully', keyVersion: metadata.version });
  } catch (err) {
    console.error('[KEY ROTATION ERROR]', err);
    return res.status(500).json({ error: 'Key rotation failed' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  return res.json({ message: 'Logged out' });
});

router.get('/me', async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: createUserResponse(user) });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session' });
  }
});

router.get('/status', (req, res) => {
  return res.json({ authenticated: !!req.cookies.token });
});

router.get('/smtp-status', (req, res) => {
  return res.json({ smtpConfigured: isSmtpConfigured() });
});

module.exports = router;
