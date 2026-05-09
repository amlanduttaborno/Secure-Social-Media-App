import os
import random
import math
import hashlib
import json

class RSAKeyPair:
    def __init__(self, n, e, d=None):
        self.n = n
        self.e = e
        self.d = d

class ECCPoint:
    def __init__(self, x, y, curve):
        self.x = x
        self.y = y
        self.curve = curve

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y and self.curve == other.curve

    def __repr__(self):
        return f"ECCPoint(x={self.x}, y={self.y})"

class ECCCurve:
    def __init__(self, p, a, b, gx, gy, n, h=1):
        self.p = p
        self.a = a
        self.b = b
        self.g = ECCPoint(gx, gy, self)
        self.n = n
        self.h = h

    def is_on_curve(self, point):
        if point is None:
            return True
        return (point.y * point.y - (point.x * point.x * point.x + self.a * point.x + self.b)) % self.p == 0

    def point_add(self, p1, p2):
        if p1 is None:
            return p2
        if p2 is None:
            return p1
        if p1.x == p2.x and p1.y != p2.y:
            return None
        if p1 == p2:
            if p1.y == 0:
                return None
            m = (3 * p1.x * p1.x + self.a) * modinv(2 * p1.y, self.p) % self.p
        else:
            m = (p2.y - p1.y) * modinv(p2.x - p1.x, self.p) % self.p
        x3 = (m * m - p1.x - p2.x) % self.p
        y3 = (m * (p1.x - x3) - p1.y) % self.p
        return ECCPoint(x3, y3, self)

    def scalar_mult(self, k, point):
        if point is None or k % self.n == 0:
            return None
        if k < 0:
            return self.scalar_mult(-k, self.neg(point))
        result = None
        addend = point
        while k:
            if k & 1:
                result = self.point_add(result, addend)
            addend = self.point_add(addend, addend)
            k >>= 1
        return result

    def neg(self, point):
        if point is None:
            return None
        return ECCPoint(point.x, (-point.y) % self.p, self)

# simple secp256k1-style curve parameters
SECP256K1 = ECCCurve(
    p=0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F,
    a=0,
    b=7,
    gx=55066263022277343669578718895168534326250603453777594175500187360389116729240,
    gy=32670510020758816978083085130507043184471273380659243275938904335757337482424,
    n=0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141,
    h=1,
)

# --- number theory helpers ---

def gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def modinv(a, m):
    a %= m
    if a < 0:
        a += m
    g, x, _ = extended_gcd(a, m)
    if g != 1:
        raise ValueError('No modular inverse')
    return x % m


def extended_gcd(a, b):
    if b == 0:
        return (a, 1, 0)
    g, x1, y1 = extended_gcd(b, a % b)
    return (g, y1, x1 - (a // b) * y1)


def is_prime(n, k=8):
    if n < 2:
        return False
    small_primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
    for p in small_primes:
        if n % p == 0:
            return n == p
    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1
    for _ in range(k):
        a = random.randrange(2, n - 1)
        x = pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def generate_prime(bits):
    while True:
        candidate = random.getrandbits(bits) | (1 << bits - 1) | 1
        if is_prime(candidate):
            return candidate

# --- RSA ---

def generate_rsa_keypair(bits=2048):
    p = generate_prime(bits // 2)
    q = generate_prime(bits // 2)
    while q == p:
        q = generate_prime(bits // 2)
    n = p * q
    phi = (p - 1) * (q - 1)
    e = 65537
    if gcd(e, phi) != 1:
        raise ValueError('Bad RSA parameters')
    d = modinv(e, phi)
    return RSAKeyPair(n=n, e=e, d=d)


def rsa_encrypt(public_key, data_bytes):
    block_size = (public_key.n.bit_length() - 1) // 8
    chunks = [data_bytes[i:i + block_size] for i in range(0, len(data_bytes), block_size)]
    cipher = b''
    for block in chunks:
        m = int.from_bytes(block, 'big')
        if m >= public_key.n:
            raise ValueError('Plaintext too long for RSA key size')
        c = pow(m, public_key.e, public_key.n)
        cipher += c.to_bytes((public_key.n.bit_length() + 7) // 8, 'big')
    return cipher


def rsa_decrypt(private_key, ciphertext):
    block_size = (private_key.n.bit_length() + 7) // 8
    chunks = [ciphertext[i:i + block_size] for i in range(0, len(ciphertext), block_size)]
    message = b''
    for block in chunks:
        c = int.from_bytes(block, 'big')
        m = pow(c, private_key.d, private_key.n)
        message += m.to_bytes(block_size - 1, 'big').lstrip(b'\x00')
    return message


def rsa_sign(private_key, data_bytes):
    digest = int.from_bytes(hashlib.sha256(data_bytes).digest(), 'big')
    sig = pow(digest, private_key.d, private_key.n)
    return sig.to_bytes((private_key.n.bit_length() + 7) // 8, 'big')


def rsa_verify(public_key, data_bytes, signature):
    sig_int = int.from_bytes(signature, 'big')
    digest = pow(sig_int, public_key.e, public_key.n)
    expected = int.from_bytes(hashlib.sha256(data_bytes).digest(), 'big')
    return digest == expected

# --- ECC encryption for small integers ---

def int_to_point(curve, m):
    x = m % curve.p
    while True:
        rhs = (x * x * x + curve.a * x + curve.b) % curve.p
        y = mod_sqrt(rhs, curve.p)
        if y is not None:
            return ECCPoint(x, y, curve)
        x = (x + 1) % curve.p


def point_to_int(point):
    return point.x


def ecc_generate_keypair(curve=SECP256K1):
    d = random.randrange(1, curve.n - 1)
    q = curve.scalar_mult(d, curve.g)
    return d, q


def ecc_encrypt_integer(curve, public_point, value):
    message_point = int_to_point(curve, value)
    k = random.randrange(1, curve.n - 1)
    c1 = curve.scalar_mult(k, curve.g)
    c2 = curve.point_add(message_point, curve.scalar_mult(k, public_point))
    return serialize_point(curve, c1) + b'|' + serialize_point(curve, c2)


def ecc_decrypt_integer(curve, private_key, ciphertext):
    data = ciphertext.split(b'|')
    c1 = deserialize_point(curve, data[0])
    c2 = deserialize_point(curve, data[1])
    shared = curve.scalar_mult(private_key, c1)
    neg_shared = curve.neg(shared)
    message_point = curve.point_add(c2, neg_shared)
    return point_to_int(message_point)


def serialize_point(curve, point):
    if point is None:
        return b'NONE'
    return f"{point.x},{point.y}".encode()


def deserialize_point(curve, blob):
    text = blob.decode()
    if text == 'NONE':
        return None
    x_str, y_str = text.split(',')
    return ECCPoint(int(x_str), int(y_str), curve)


def mod_sqrt(a, p):
    if a == 0:
        return 0
    if p % 4 == 3:
        x = pow(a, (p + 1) // 4, p)
        if (x * x) % p == a:
            return x
        return None
    # Tonelli-Shanks not required for assignment size
    return None
