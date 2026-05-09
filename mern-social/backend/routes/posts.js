const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { rsaEncrypt, rsaDecrypt, createHmac, verifyHmac } = require('../utils/kms');

const router = express.Router();

function buildPostResponse(post) {
  const author = post.author || {};
  if (!verifyHmac(post.titleEnc, post.titleMac) || !verifyHmac(post.bodyEnc, post.bodyMac)) {
    throw new Error('Post integrity validation failed');
  }
  return {
    id: post._id,
    title: rsaDecrypt(post.titleEnc, post.titleKeyVersion),
    body: rsaDecrypt(post.bodyEnc, post.bodyKeyVersion),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: {
      id: author._id,
      username: author.usernameEnc ? rsaDecrypt(author.usernameEnc, author.usernameKeyVersion) : undefined,
      displayName: author.profile?.displayNameEnc
        ? rsaDecrypt(author.profile.displayNameEnc, author.profile.displayNameKeyVersion)
        : undefined,
      avatarUrl: author.profile?.avatarUrl || '',
    },
  };
}

router.get('/', async (req, res) => {
  const posts = await Post.find().populate('author').sort({ createdAt: -1 });
  return res.json({ posts: posts.map(buildPostResponse) });
});

router.post('/', verifyToken, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  const encryptedTitle = rsaEncrypt(title);
  const encryptedBody = rsaEncrypt(body);

  const post = await Post.create({
    author: req.user.id,
    titleEnc: encryptedTitle.ciphertext,
    titleMac: encryptedTitle.mac,
    titleKeyVersion: encryptedTitle.keyVersion,
    bodyEnc: encryptedBody.ciphertext,
    bodyMac: encryptedBody.mac,
    bodyKeyVersion: encryptedBody.keyVersion,
  });

  const author = await User.findById(req.user.id);
  return res.status(201).json({ post: buildPostResponse({ ...post.toObject(), author }) });
});

router.put('/:postId', verifyToken, async (req, res) => {
  const { postId } = req.params;
  const { title, body } = req.body;
  const post = await Post.findById(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (String(post.author) !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  if (title !== undefined) {
    const encryptedTitle = rsaEncrypt(title);
    post.titleEnc = encryptedTitle.ciphertext;
    post.titleMac = encryptedTitle.mac;
    post.titleKeyVersion = encryptedTitle.keyVersion;
  }
  if (body !== undefined) {
    const encryptedBody = rsaEncrypt(body);
    post.bodyEnc = encryptedBody.ciphertext;
    post.bodyMac = encryptedBody.mac;
    post.bodyKeyVersion = encryptedBody.keyVersion;
  }

  post.updatedAt = new Date();
  await post.save();
  const author = await User.findById(req.user.id);
  return res.json({ post: buildPostResponse({ ...post.toObject(), author }) });
});

router.delete('/:postId', verifyToken, async (req, res) => {
  const { postId } = req.params;
  const post = await Post.findById(postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (String(post.author) !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  await Post.deleteOne({ _id: postId });
  return res.json({ message: 'Post deleted' });
});

module.exports = router;
