const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { rsaEncrypt, rsaDecrypt, createHmac, verifyHmac } = require('../utils/kms');

const router = express.Router();

function buildPostResponse(post) {
  const author = post.author || {};
  const isTitleValid = verifyHmac(post.titleEnc, post.titleMac);
  const isBodyValid = verifyHmac(post.bodyEnc, post.bodyMac);

  return {
    id: post._id,
    title: isTitleValid ? rsaDecrypt(post.titleEnc, post.titleKeyVersion) : '[Integrity Error]',
    body: isBodyValid ? rsaDecrypt(post.bodyEnc, post.bodyKeyVersion) : 'This content could not be verified.',
    integrityError: !isTitleValid || !isBodyValid,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: {
      id: author._id,
      username: author.usernameEnc && verifyHmac(author.usernameEnc, author.usernameMac)
        ? rsaDecrypt(author.usernameEnc, author.usernameKeyVersion)
        : 'unknown',
      displayName: author.profile?.displayNameEnc && verifyHmac(author.profile.displayNameEnc, author.profile.displayNameMac)
        ? rsaDecrypt(author.profile.displayNameEnc, author.profile.displayNameKeyVersion)
        : 'Unknown User',
      avatarUrl: author.profile?.avatarUrl || '',
    },
  };
}

router.get('/', async (req, res, next) => {
  try {
    const posts = await Post.find().populate('author').sort({ createdAt: -1 });
    return res.json({ posts: posts.map(buildPostResponse) });
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, async (req, res, next) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
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
  } catch (err) {
    next(err);
  }
});

router.put('/:postId', verifyToken, async (req, res, next) => {
  const { postId } = req.params;
  const { title, body } = req.body;
  try {
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
  } catch (err) {
    next(err);
  }
});

router.delete('/:postId', verifyToken, async (req, res, next) => {
  const { postId } = req.params;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (String(post.author) !== req.user.id) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    await Post.deleteOne({ _id: postId });
    return res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
