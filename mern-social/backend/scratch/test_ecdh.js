const crypto = require('crypto');

function generateKeys() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

const keys = generateKeys();

const { publicKey: ephPublicKey, privateKey: ephPrivateKey } = generateKeys();

try {
  const shared = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey(ephPrivateKey),
    publicKey: crypto.createPublicKey(keys.publicKey)
  });
  console.log('Success!', shared.length);
} catch (err) {
  console.error('Failed!', err);
}
