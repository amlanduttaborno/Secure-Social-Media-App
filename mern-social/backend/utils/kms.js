const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const KEY_PATH = path.join(DATA_DIR, 'key_store.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function generateKeys() {
  const rsa = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  const ecc = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return {
    rsaPublicKey: rsa.publicKey,
    rsaPrivateKey: rsa.privateKey,
    eccPublicKey: ecc.publicKey,
    eccPrivateKey: ecc.privateKey,
    macKey: crypto.randomBytes(32).toString('base64'),
    version: 1,
    previousKeys: [],
  };
}

function loadKeys() {
  ensureDataDir();
  if (!fs.existsSync(KEY_PATH)) {
    const keys = generateKeys();
    fs.writeFileSync(KEY_PATH, JSON.stringify(keys, null, 2), 'utf-8');
    return keys;
  }

  const stored = JSON.parse(fs.readFileSync(KEY_PATH, 'utf-8'));
  let modified = false;
  if (!stored.macKey) {
    stored.macKey = crypto.randomBytes(32).toString('base64');
    modified = true;
  }
  if (!stored.previousKeys) {
    stored.previousKeys = [];
    modified = true;
  }
  if (!stored.version) {
    stored.version = 1;
    modified = true;
  }
  if (modified) {
    saveKeys(stored);
  }
  return stored;
}

function saveKeys(updatedKeys) {
  fs.writeFileSync(KEY_PATH, JSON.stringify(updatedKeys, null, 2), 'utf-8');
}

const keys = loadKeys();

function getKeySet(version) {
  if (!version || version === keys.version) {
    return keys;
  }
  const previous = keys.previousKeys.find((entry) => entry.version === version);
  if (!previous) {
    throw new Error('Unknown key version');
  }
  return previous;
}

function parseCiphertext(ciphertext) {
  if (typeof ciphertext !== 'string') {
    return null;
  }
  try {
    return JSON.parse(ciphertext);
  } catch {
    return null;
  }
}

function hashText(text) {
  return crypto.createHash('sha256').update(text.trim().toLowerCase(), 'utf8').digest('hex');
}

function createSalt() {
  return crypto.randomBytes(16).toString('base64');
}

function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(`${salt}:${pin}`, 'utf8').digest('hex');
}

function chunkBuffer(buffer, size) {
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += size) {
    chunks.push(buffer.slice(offset, offset + size));
  }
  return chunks;
}

function deriveKey(secret, length) {
  const out = Buffer.alloc(length);
  let counter = 0;
  let prev = secret;
  let written = 0;

  while (written < length) {
    prev = crypto.createHash('sha512').update(prev).update(Buffer.from([counter++])).digest();
    const sliceSize = Math.min(prev.length, length - written);
    prev.copy(out, written, 0, sliceSize);
    written += sliceSize;
  }

  return out;
}

function xorBuffers(buffer, key) {
  const result = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    result[i] = buffer[i] ^ key[i];
  }
  return result;
}

function createHmac(value) {
  return crypto.createHmac('sha256', Buffer.from(keys.macKey, 'base64'))
    .update(value)
    .digest('base64');
}

function verifyHmac(value, tag) {
  const expected = createHmac(value);
  try {
    const a = Buffer.from(expected, 'base64');
    const b = Buffer.from(tag, 'base64');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function rsaEncrypt(value, version = keys.version) {
  const keySet = getKeySet(version);
  const buffer = Buffer.from(value, 'utf8');
  const maxChunk = 446;
  const chunks = chunkBuffer(buffer, maxChunk).map((chunk) =>
    crypto.publicEncrypt(
      {
        key: keySet.rsaPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      chunk
    ).toString('base64')
  );
  return {
    ciphertext: JSON.stringify(chunks),
    keyVersion: keySet.version,
    mac: createHmac(JSON.stringify(chunks)),
  };
}

function rsaDecrypt(ciphertext, version = keys.version) {
  if (!ciphertext) {
    return '';
  }
  const chunks = parseCiphertext(ciphertext);
  if (!Array.isArray(chunks)) {
    return ciphertext;
  }
  try {
    const keySet = getKeySet(version);
    const decrypted = Buffer.concat(
      chunks.map((chunk) =>
        crypto.privateDecrypt(
          {
            key: keySet.rsaPrivateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
          },
          Buffer.from(chunk, 'base64')
        )
      )
    );
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[KMS RSA DECRYPT ERROR]', err.message);
    return '';
  }
}

function safeRsaDecrypt(ciphertext, mac, version = keys.version) {
  if (!ciphertext) {
    return '';
  }
  const chunks = parseCiphertext(ciphertext);
  if (!Array.isArray(chunks)) {
    return ciphertext;
  }
  if (!mac || !verifyHmac(ciphertext, mac)) {
    return '';
  }
  return rsaDecrypt(ciphertext, version);
}

function eccEncrypt(value) {
  const { publicKey: ephPublicKey, privateKey: ephPrivateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const shared = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey(ephPrivateKey),
    publicKey: crypto.createPublicKey(keys.eccPublicKey),
  });

  const plaintext = Buffer.from(value, 'utf8');
  const key = deriveKey(shared, plaintext.length);
  const ciphertext = xorBuffers(plaintext, key);
  const encoded = ciphertext.toString('base64');
  const mac = createHmac(`${encoded}.${Buffer.from(ephPublicKey, 'utf8').toString('base64')}`);

  return {
    ciphertext: encoded,
    ephemeralPublicKey: Buffer.from(ephPublicKey, 'utf8').toString('base64'),
    keyVersion: keys.version,
    mac,
  };
}

function eccDecrypt({ ciphertext, ephemeralPublicKey, mac }) {
  const ephPubPem = Buffer.from(ephemeralPublicKey, 'base64').toString('utf8');
  if (!verifyHmac(`${ciphertext}.${ephemeralPublicKey}`, mac)) {
    throw new Error('OTP integrity check failed');
  }

  const shared = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey(keys.eccPrivateKey),
    publicKey: crypto.createPublicKey(ephPubPem),
  });

  const encrypted = Buffer.from(ciphertext, 'base64');
  const key = deriveKey(shared, encrypted.length);
  return xorBuffers(encrypted, key).toString('utf8');
}

function rotateKeys() {
  const old = {
    version: keys.version,
    rsaPublicKey: keys.rsaPublicKey,
    rsaPrivateKey: keys.rsaPrivateKey,
    eccPublicKey: keys.eccPublicKey,
    eccPrivateKey: keys.eccPrivateKey,
  };
  const fresh = generateKeys();
  const rotated = {
    ...fresh,
    macKey: keys.macKey,
    version: keys.version + 1,
    previousKeys: [old, ...keys.previousKeys],
  };
  Object.assign(keys, rotated);
  saveKeys(keys);
  return { version: keys.version };
}

module.exports = {
  rsaEncrypt,
  rsaDecrypt,
  eccEncrypt,
  eccDecrypt,
  hashText,
  hashPin,
  createSalt,
  createHmac,
  verifyHmac,
  safeRsaDecrypt,
  rotateKeys,
  getKeySet,
};
