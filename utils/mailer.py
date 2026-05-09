import os
import datetime
import smtplib
from email.message import EmailMessage
from pathlib import Path

LOG_PATH = Path('data/otp_email_log.txt')
ENV_PATH = Path('.env')


def load_env_file(env_path: Path = ENV_PATH):
    if not env_path.exists():
        return
    with env_path.open('r', encoding='utf-8') as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env_file()

SMTP_SERVER = os.environ.get('SMTP_SERVER')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
EMAIL_FROM = os.environ.get('EMAIL_FROM', 'no-reply@example.com')
SMTP_USE_SSL = os.environ.get('SMTP_USE_SSL', 'false').lower() in ('1', 'true', 'yes')


def ensure_data_dir():
    data_dir = LOG_PATH.parent
    if not data_dir.exists():
        data_dir.mkdir(parents=True, exist_ok=True)


def is_smtp_configured() -> bool:
    return bool(SMTP_SERVER and SMTP_USERNAME and SMTP_PASSWORD)


def log_otp_delivery(email: str, code: str, method: str):
    ensure_data_dir()
    timestamp = datetime.datetime.utcnow().isoformat()
    message = f"[{timestamp}] OTP {method} to {email}: {code}\n"
    with open(LOG_PATH, 'a', encoding='utf-8') as fh:
        fh.write(message)


def send_otp_email(email: str, code: str) -> bool:
    log_otp_delivery(email, code, 'logged')
    if not is_smtp_configured():
        return False

    message = EmailMessage()
    message['Subject'] = 'Your Secure Social Media Verification Code'
    message['From'] = EMAIL_FROM
    message['To'] = email
    message.set_content(
        f"Your Secure Social Media verification code is: {code}\n\n"
        "If you did not request this, ignore this email."
    )

    try:
        if SMTP_USE_SSL:
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as smtp:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as smtp:
                smtp.starttls()
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
                smtp.send_message(message)
        log_otp_delivery(email, code, 'emailed')
        return True
    except Exception:
        return False
