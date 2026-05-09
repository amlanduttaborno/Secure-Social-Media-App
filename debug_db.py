import sqlite3
import base64
from crypto.kms import KeyManager

conn = sqlite3.connect('data/app.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
print('users:')
for row in cur.execute('SELECT id, username_enc, email_enc, password_salt, password_hash FROM users'):
    print('id', row['id'])
    print('  username_enc', row['username_enc'][:80])
    print('  email_enc', row['email_enc'][:80])
    try:
        kms = KeyManager()
        username = kms.rsa_decrypt_bytes(base64.b64decode(row['username_enc'].encode())).decode()
        email = kms.rsa_decrypt_bytes(base64.b64decode(row['email_enc'].encode())).decode()
        print('  decrypted username', username)
        print('  decrypted email', email)
    except Exception as e:
        print('  decrypt error', e)
conn.close()
