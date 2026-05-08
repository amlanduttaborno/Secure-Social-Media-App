const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { rsaDecrypt } = require('./utils/kms');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secure-social';
(async () => {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const users = await User.find({}).limit(1);
  if (!users.length) {
    console.log('No users found');
    return process.exit(0);
  }
  const user = users[0];
  const password = 'Password123!';
  const salt = bcrypt.genSaltSync(12);
  user.passwordHash = bcrypt.hashSync(password, salt);
  await user.save();
  console.log('Updated user:', {
    id: user._id.toString(),
    username: rsaDecrypt(user.usernameEnc, user.usernameKeyVersion),
    email: rsaDecrypt(user.emailEnc, user.emailKeyVersion),
    newPassword: password,
  });
  await mongoose.disconnect();
  process.exit(0);
})();
