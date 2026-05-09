import os
import hashlib

BLOCK_SIZE = 64


def sha256(data):
    return hashlib.sha256(data).digest()


def hmac_sha256(key, message):
    if isinstance(key, str):
        key = key.encode()
    if isinstance(message, str):
        message = message.encode()
    if len(key) > BLOCK_SIZE:
        key = sha256(key)
    key = key.ljust(BLOCK_SIZE, b'\x00')
    o_key_pad = bytes((b ^ 0x5c) for b in key)
    i_key_pad = bytes((b ^ 0x36) for b in key)
    return sha256(o_key_pad + sha256(i_key_pad + message))


def pbkdf2_sha256(password, salt, iterations=100000, dklen=32):
    if isinstance(password, str):
        password = password.encode()
    if isinstance(salt, str):
        salt = salt.encode()
    def prf(key, data):
        return hmac_sha256(key, data)
    blocks = []
    block_count = -(-dklen // hashlib.sha256().digest_size)
    for block_index in range(1, block_count + 1):
        u = prf(password, salt + block_index.to_bytes(4, 'big'))
        result = bytearray(u)
        for _ in range(1, iterations):
            u = prf(password, u)
            result = bytearray(x ^ y for x, y in zip(result, u))
        blocks.append(result)
    return b''.join(blocks)[:dklen]


def generate_salt(length=16):
    return os.urandom(length)


def hash_password(password, salt=None):
    if salt is None:
        salt = generate_salt()
    hashed = pbkdf2_sha256(password, salt, iterations=150000, dklen=32)
    return salt, hashed


def verify_password(password, salt, expected_hash):
    return pbkdf2_sha256(password, salt, iterations=150000, dklen=32) == expected_hash
