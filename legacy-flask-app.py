import os
import base64
import sqlite3
import secrets
import datetime
from pathlib import Path
from flask import Flask, request, redirect, url_for, render_template, make_response, g, flash
from crypto.hash_utils import hash_password, verify_password, hmac_sha256
from crypto.kms import KeyManager
from utils.mailer import send_otp_email, is_smtp_configured
from pathlib import Path

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET') or secrets.token_hex(32)
DATA_DIR = Path('data')
DB_PATH = DATA_DIR / 'app.db'
AUTH_COOKIE_NAME = 'secure_auth_token'
AUTH_SIG_NAME = 'secure_auth_sig'
PENDING_COOKIE_NAME = 'pending_user'

kms = KeyManager()
MAC_KEY = kms.derive_mac_key()

if not DATA_DIR.exists():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

# --- database helpers ---

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(str(DB_PATH))
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


def execute_db(query, args=()):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, args)
    conn.commit()
    return cur.lastrowid

# --- crypto helpers ---

def encrypt_text(value: str) -> str:
    if value is None:
        return ''
    ciphertext = kms.rsa_encrypt_bytes(value.encode())
    return base64.b64encode(ciphertext).decode()


def decrypt_text(encoded: str) -> str:
    if not encoded:
        return ''
    ciphertext = base64.b64decode(encoded.encode())
    plaintext = kms.rsa_decrypt_bytes(ciphertext)
    return plaintext.decode()


def make_mac(ciphertext: bytes) -> str:
    return base64.b64encode(hmac_sha256(MAC_KEY, ciphertext)).decode()


def verify_mac(ciphertext: bytes, mac: str) -> bool:
    return make_mac(ciphertext) == mac


def sign_message(message: str, prefix: bytes) -> str:
    return base64.b64encode(hmac_sha256(prefix + MAC_KEY, message.encode())).decode()


def verify_signature(message: str, signature: str, prefix: bytes) -> bool:
    return sign_message(message, prefix) == signature


def hash_user_token(token: str) -> str:
    return base64.b64encode(hmac_sha256(b'hash' + MAC_KEY, token.encode())).decode()


def create_session_cookie(response, token):
    sig = sign_message(token, b'sig')
    response.set_cookie(AUTH_COOKIE_NAME, token, httponly=True, samesite='Strict')
    response.set_cookie(AUTH_SIG_NAME, sig, httponly=True, samesite='Strict')


def clear_session_cookie(response):
    response.delete_cookie(AUTH_COOKIE_NAME)
    response.delete_cookie(AUTH_SIG_NAME)


def set_pending_login(response, user_id):
    token = str(user_id)
    sig = sign_message(token, b'pending')
    response.set_cookie(PENDING_COOKIE_NAME, token, httponly=True, samesite='Strict')
    response.set_cookie(f'{PENDING_COOKIE_NAME}_sig', sig, httponly=True, samesite='Strict')


def clear_pending_login(response):
    response.delete_cookie(PENDING_COOKIE_NAME)
    response.delete_cookie(f'{PENDING_COOKIE_NAME}_sig')


def get_pending_login():
    token = request.cookies.get(PENDING_COOKIE_NAME)
    sig = request.cookies.get(f'{PENDING_COOKIE_NAME}_sig')
    if not token or not sig:
        return None
    if verify_signature(token, sig, b'pending'):
        return int(token)
    return None


def create_session(user_id):
    token = secrets.token_hex(32)
    execute_db(
        'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        (user_id, hash_user_token(token), (datetime.datetime.utcnow() + datetime.timedelta(hours=2)).isoformat())
    )
    return token


def get_current_user():
    token = request.cookies.get(AUTH_COOKIE_NAME)
    sig = request.cookies.get(AUTH_SIG_NAME)
    if not token or not sig:
        return None
    if not verify_signature(token, sig, b'sig'):
        return None
    token_hash = hash_user_token(token)
    session = query_db('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?', (token_hash, datetime.datetime.utcnow().isoformat()), one=True)
    if not session:
        return None
    user = query_db('SELECT * FROM users WHERE id = ?', (session['user_id'],), one=True)
    return user

@app.context_processor
def inject_current_user():
    return {'current_user': get_current_user()}


def require_login():
    user = get_current_user()
    if user is None:
        return redirect(url_for('login'))
    return user


def require_admin():
    user = get_current_user()
    if user is None or user['role'] != 'admin':
        return redirect(url_for('login'))
    return user


def init_db():
    if not DB_PATH.exists():
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username_enc TEXT NOT NULL,
                email_enc TEXT NOT NULL,
                contact_enc TEXT NOT NULL,
                password_hash BLOB NOT NULL,
                password_salt BLOB NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER NOT NULL,
                title_enc TEXT NOT NULL,
                body_enc TEXT NOT NULL,
                mac TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(author_id) REFERENCES users(id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE otps (
                user_id INTEGER PRIMARY KEY,
                otp_enc TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        conn.commit()
        conn.close()
        with app.app_context():
            create_default_admin()
    else:
        with app.app_context():
            ensure_admin_exists()


def ensure_admin_exists():
    existing_admin = query_db('SELECT id FROM users WHERE role = ?', ('admin',), one=True)
    if existing_admin is None:
        create_default_admin()


def create_default_admin():
    username = 'admin'
    email = 'admin@example.com'
    contact = '+0000000000'
    password = 'Admin@123'
    salt, password_hash = hash_password(password)
    execute_db(
        'INSERT INTO users (username_enc, email_enc, contact_enc, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (
            encrypt_text(username),
            encrypt_text(email),
            encrypt_text(contact),
            password_hash,
            salt,
            'admin',
            datetime.datetime.utcnow().isoformat()
        )
    )

# --- application routes ---

@app.route('/')
def index():
    user = get_current_user()
    if user:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        email = request.form['email'].strip()
        contact = request.form['contact'].strip()
        password = request.form['password']
        confirm = request.form['confirm_password']
        if not username or not email or not contact or not password:
            flash('All fields are required.', 'danger')
        elif password != confirm:
            flash('Passwords do not match.', 'danger')
        else:
            salt, password_hash = hash_password(password)
            execute_db(
                'INSERT INTO users (username_enc, email_enc, contact_enc, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (
                    encrypt_text(username),
                    encrypt_text(email),
                    encrypt_text(contact),
                    password_hash,
                    salt,
                    'user',
                    datetime.datetime.utcnow().isoformat()
                )
            )
            flash('Registration successful. Please log in.', 'success')
            return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        users = query_db('SELECT * FROM users', ())
        user = None
        for row in users:
            if decrypt_text(row['username_enc']) == username:
                user = row
                break
        if user is None:
            flash('Invalid credentials.', 'danger')
            return render_template('login.html')
        if not verify_password(password, user['password_salt'], user['password_hash']):
            flash('Invalid credentials.', 'danger')
            return render_template('login.html')
        code = secrets.randbelow(900000) + 100000
        encrypted_code = base64.b64encode(kms.ecc_encrypt_code(code)).decode()
        execute_db('REPLACE INTO otps (user_id, otp_enc, expires_at) VALUES (?, ?, ?)',
                   (user['id'], encrypted_code, (datetime.datetime.utcnow() + datetime.timedelta(minutes=5)).isoformat()))
        email_address = decrypt_text(user['email_enc'])
        sent = send_otp_email(email_address, str(code))
        response = make_response(redirect(url_for('verify')))
        set_pending_login(response, user['id'])
        if sent:
            flash('A verification code has been sent to your registered email.', 'info')
        else:
            flash('Email sending is not configured. The OTP is logged to data/otp_email_log.txt for testing.', 'warning')
        return response
    return render_template('login.html')

@app.route('/verify', methods=['GET', 'POST'])
def verify():
    pending_id = get_pending_login()
    if pending_id is None:
        flash('No pending login session found.', 'warning')
        return redirect(url_for('login'))
    otp_record = query_db('SELECT * FROM otps WHERE user_id = ?', (pending_id,), one=True)
    if not otp_record:
        flash('Verification data not found.', 'danger')
        return redirect(url_for('login'))
    if datetime.datetime.utcnow() > datetime.datetime.fromisoformat(otp_record['expires_at']):
        flash('OTP expired. Please log in again.', 'danger')
        return redirect(url_for('login'))
    if request.method == 'POST':
        entered = request.form['otp'].strip()
        try:
            decrypted = kms.ecc_decrypt_code(base64.b64decode(otp_record['otp_enc'].encode()))
        except Exception:
            flash('Verification failed.', 'danger')
            return render_template('verify.html')
        if str(decrypted) != entered:
            flash('Invalid verification code.', 'danger')
            return render_template('verify.html', smtp_configured=is_smtp_configured())
        token = create_session(pending_id)
        response = make_response(redirect(url_for('dashboard')))
        create_session_cookie(response, token)
        clear_pending_login(response)
        execute_db('DELETE FROM otps WHERE user_id = ?', (pending_id,))
        return response
    return render_template('verify.html', smtp_configured=is_smtp_configured())

@app.route('/otp-log', methods=['GET'])
def otp_log():
    if is_smtp_configured():
        flash('SMTP is configured; OTP log should not be used in production.', 'warning')
        return redirect(url_for('login'))
    log_path = Path('data/otp_email_log.txt')
    if not log_path.exists():
        flash('OTP log file not found yet.', 'warning')
        return redirect(url_for('login'))
    with log_path.open('r', encoding='utf-8') as fh:
        lines = fh.readlines()[-20:]
    return render_template('otp_log.html', lines=lines)

@app.route('/logout')
def logout():
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if token:
        execute_db('DELETE FROM sessions WHERE token_hash = ?', (hash_user_token(token),))
    response = make_response(redirect(url_for('login')))
    clear_session_cookie(response)
    clear_pending_login(response)
    flash('Logged out securely.', 'success')
    return response

@app.route('/dashboard')
def dashboard():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    posts = query_db('SELECT * FROM posts WHERE author_id = ? ORDER BY created_at DESC', (user['id'],))
    decrypted_posts = []
    for post in posts:
        title_cipher = base64.b64decode(post['title_enc'].encode())
        body_cipher = base64.b64decode(post['body_enc'].encode())
        if not verify_mac(title_cipher + body_cipher, post['mac']):
            continue
        decrypted_posts.append({
            'id': post['id'],
            'title': decrypt_text(post['title_enc']),
            'body': decrypt_text(post['body_enc']),
            'created_at': post['created_at'],
            'updated_at': post['updated_at'],
        })
    profile = {
        'username': decrypt_text(user['username_enc']),
        'email': decrypt_text(user['email_enc']),
        'contact': decrypt_text(user['contact_enc']),
        'role': user['role'],
    }
    return render_template('dashboard.html', posts=decrypted_posts, profile=profile)

@app.route('/create_post', methods=['GET', 'POST'])
def create_post():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    if request.method == 'POST':
        title = request.form['title'].strip()
        body = request.form['body'].strip()
        if not title or not body:
            flash('Title and post body are required.', 'danger')
            return render_template('create_post.html')
        title_cipher = base64.b64encode(kms.rsa_encrypt_bytes(title.encode())).decode()
        body_cipher = base64.b64encode(kms.rsa_encrypt_bytes(body.encode())).decode()
        mac_value = make_mac(base64.b64decode(title_cipher.encode()) + base64.b64decode(body_cipher.encode()))
        execute_db('INSERT INTO posts (author_id, title_enc, body_enc, mac, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                   (user['id'], title_cipher, body_cipher, mac_value, datetime.datetime.utcnow().isoformat(), datetime.datetime.utcnow().isoformat()))
        flash('Post created successfully.', 'success')
        return redirect(url_for('dashboard'))
    return render_template('create_post.html')

@app.route('/edit_post/<int:post_id>', methods=['GET', 'POST'])
def edit_post(post_id):
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    post = query_db('SELECT * FROM posts WHERE id = ? AND author_id = ?', (post_id, user['id']), one=True)
    if not post:
        flash('Post not found or access denied.', 'danger')
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        title = request.form['title'].strip()
        body = request.form['body'].strip()
        if not title or not body:
            flash('Title and post body are required.', 'danger')
            return render_template('edit_post.html', title=title, body=body)
        title_cipher = base64.b64encode(kms.rsa_encrypt_bytes(title.encode())).decode()
        body_cipher = base64.b64encode(kms.rsa_encrypt_bytes(body.encode())).decode()
        mac_value = make_mac(base64.b64decode(title_cipher.encode()) + base64.b64decode(body_cipher.encode()))
        execute_db('UPDATE posts SET title_enc = ?, body_enc = ?, mac = ?, updated_at = ? WHERE id = ?',
                   (title_cipher, body_cipher, mac_value, datetime.datetime.utcnow().isoformat(), post_id))
        flash('Post updated successfully.', 'success')
        return redirect(url_for('dashboard'))
    return render_template('edit_post.html', title=decrypt_text(post['title_enc']), body=decrypt_text(post['body_enc']))

@app.route('/edit_profile', methods=['GET', 'POST'])
def edit_profile():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    if request.method == 'POST':
        email = request.form['email'].strip()
        contact = request.form['contact'].strip()
        if not email or not contact:
            flash('Email and contact are required.', 'danger')
        else:
            execute_db('UPDATE users SET email_enc = ?, contact_enc = ? WHERE id = ?',
                       (encrypt_text(email), encrypt_text(contact), user['id']))
            flash('Profile updated successfully.', 'success')
            return redirect(url_for('dashboard'))
    return render_template('edit_profile.html', email=decrypt_text(user['email_enc']), contact=decrypt_text(user['contact_enc']))

@app.route('/admin', methods=['GET'])
def admin_panel():
    user = require_admin()
    if not user:
        return redirect(url_for('login'))
    users = query_db('SELECT * FROM users ORDER BY id ASC')
    decrypted = []
    for row in users:
        decrypted.append({
            'id': row['id'],
            'username': decrypt_text(row['username_enc']),
            'email': decrypt_text(row['email_enc']),
            'contact': decrypt_text(row['contact_enc']),
            'role': row['role'],
            'created_at': row['created_at'],
        })
    return render_template('admin.html', users=decrypted)

@app.route('/delete_user/<int:user_id>', methods=['POST'])
def delete_user(user_id):
    user = require_admin()
    if not user:
        return redirect(url_for('login'))
    if user_id == user['id']:
        flash('Administrators cannot delete their own account.', 'warning')
        return redirect(url_for('admin_panel'))
    execute_db('DELETE FROM users WHERE id = ?', (user_id,))
    execute_db('DELETE FROM posts WHERE author_id = ?', (user_id,))
    execute_db('DELETE FROM sessions WHERE user_id = ?', (user_id,))
    execute_db('DELETE FROM otps WHERE user_id = ?', (user_id,))
    flash('User account deleted successfully.', 'success')
    return redirect(url_for('admin_panel'))


def reencrypt_database(old_rsa_key):
    users = query_db('SELECT id, username_enc, email_enc, contact_enc FROM users')
    for row in users:
        username = rsa_decrypt_with_key(old_rsa_key, base64.b64decode(row['username_enc'].encode())).decode()
        email = rsa_decrypt_with_key(old_rsa_key, base64.b64decode(row['email_enc'].encode())).decode()
        contact = rsa_decrypt_with_key(old_rsa_key, base64.b64decode(row['contact_enc'].encode())).decode()
        execute_db('UPDATE users SET username_enc = ?, email_enc = ?, contact_enc = ? WHERE id = ?',
                   (encrypt_text(username), encrypt_text(email), encrypt_text(contact), row['id']))
    posts = query_db('SELECT id, title_enc, body_enc FROM posts')
    for row in posts:
        title = rsa_decrypt_with_key(old_rsa_key, base64.b64decode(row['title_enc'].encode())).decode()
        body = rsa_decrypt_with_key(old_rsa_key, base64.b64decode(row['body_enc'].encode())).decode()
        title_cipher = kms.rsa_encrypt_bytes(title.encode())
        body_cipher = kms.rsa_encrypt_bytes(body.encode())
        mac_value = make_mac(title_cipher + body_cipher)
        execute_db('UPDATE posts SET title_enc = ?, body_enc = ?, mac = ? WHERE id = ?',
                   (base64.b64encode(title_cipher).decode(), base64.b64encode(body_cipher).decode(), mac_value, row['id']))


def rsa_decrypt_with_key(key, ciphertext: bytes) -> bytes:
    from crypto.asymmetric import RSAKeyPair, rsa_decrypt
    return rsa_decrypt(key, ciphertext)

@app.route('/rotate_keys', methods=['POST'])
def rotate_keys():
    user = require_admin()
    if not user:
        return redirect(url_for('login'))
    old_rsa = kms.rsa_key
    kms.rotate_keys()
    reencrypt_database(old_rsa)
    flash('Master keys rotated successfully. Existing data has been re-encrypted.', 'success')
    return redirect(url_for('admin_panel'))

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
