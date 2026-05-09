import os
import json
import base64
from pathlib import Path
from .asymmetric import (
    RSAKeyPair,
    generate_rsa_keypair,
    rsa_encrypt,
    rsa_decrypt,
    ecc_generate_keypair,
    ecc_encrypt_integer,
    ecc_decrypt_integer,
    SECP256K1,
)
from .hash_utils import sha256

KMS_STORE = 'data/kms_store.json'

class KeyManager:
    def __init__(self):
        self.store_path = Path(KMS_STORE)
        self.rsa_key = None
        self.ecc_priv = None
        self.ecc_pub = None
        self.load_or_initialize()

    def load_or_initialize(self):
        if not self.store_path.parent.exists():
            self.store_path.parent.mkdir(parents=True, exist_ok=True)
        if self.store_path.exists():
            with open(self.store_path, 'r') as fh:
                data = json.load(fh)
                self.rsa_key = generate_rsa_keypair_from_data(data['rsa'])
                self.ecc_priv = int(data['ecc_private'], 16)
                self.ecc_pub = (int(data['ecc_public_x'], 16), int(data['ecc_public_y'], 16))
        else:
            self.rotate_keys()

    def rotate_keys(self):
        rsa = generate_rsa_keypair(2048)
        ecc_priv, ecc_pub = ecc_generate_keypair(SECP256K1)
        self.rsa_key = rsa
        self.ecc_priv = ecc_priv
        self.ecc_pub = (ecc_pub.x, ecc_pub.y)
        self.save_store()

    def save_store(self):
        payload = {
            'rsa': {
                'n': hex(self.rsa_key.n),
                'e': hex(self.rsa_key.e),
                'd': hex(self.rsa_key.d),
            },
            'ecc_private': hex(self.ecc_priv),
            'ecc_public_x': hex(self.ecc_pub[0]),
            'ecc_public_y': hex(self.ecc_pub[1]),
        }
        with open(self.store_path, 'w') as fh:
            json.dump(payload, fh, indent=2)

    def get_rsa_public(self):
        return RSAKeyPair(n=self.rsa_key.n, e=self.rsa_key.e)

    def get_rsa_private(self):
        return self.rsa_key

    def get_ecc_public(self):
        return self.ecc_pub

    def get_ecc_private(self):
        return self.ecc_priv

    def rsa_encrypt_bytes(self, plaintext: bytes) -> bytes:
        return rsa_encrypt(self.get_rsa_public(), plaintext)

    def rsa_decrypt_bytes(self, ciphertext: bytes) -> bytes:
        return rsa_decrypt(self.get_rsa_private(), ciphertext)

    def ecc_encrypt_code(self, code: int) -> bytes:
        public_point = SECP256K1.scalar_mult(self.ecc_priv, SECP256K1.g)
        return ecc_encrypt_integer(SECP256K1, public_point, code)

    def ecc_decrypt_code(self, ciphertext: bytes) -> int:
        return ecc_decrypt_integer(SECP256K1, self.ecc_priv, ciphertext)

    def derive_mac_key(self):
        data = f"{self.rsa_key.n}{self.ecc_pub[0]}{self.ecc_pub[1]}".encode()
        return sha256(data)


def generate_rsa_keypair_from_data(data):
    rsa = RSAKeyPair(n=int(data['n'], 16), e=int(data['e'], 16), d=int(data['d'], 16))
    return rsa
