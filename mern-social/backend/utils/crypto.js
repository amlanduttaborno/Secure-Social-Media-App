const crypto = require('crypto');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createJwtToken(user) {
  const payload = { id: user._id, role: user.role, username: user.username };
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'default_jwt_secret')
    .update(JSON.stringify(payload))
    .digest('hex');
}

module.exports = {
  generateOtp,
  createJwtToken,
};
