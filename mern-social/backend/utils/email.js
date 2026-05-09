const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const LOG_PATH = path.join(__dirname, '..', 'data', 'otp_email_log.txt');

function ensureLogDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || process.env.SMTP_SERVER;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  const secureEnv = process.env.SMTP_SECURE || process.env.SMTP_USE_SSL;
  const tlsEnv = process.env.SMTP_TLS || process.env.SMTP_USE_TLS;
  const rejectUnauthorized = String(process.env.SMTP_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  const secure = String(secureEnv).toLowerCase() === 'true' || Number(port) === 465;
  const requireTLS = String(tlsEnv || 'true').toLowerCase() === 'true' && !secure;

  return {
    host,
    port: Number(port),
    secure,
    requireTLS,
    tls: { rejectUnauthorized },
    auth: { user, pass },
    from,
  };
}

function isSmtpConfigured() {
  return Boolean(getSmtpConfig());
}

async function sendOtpEmail(email, code) {
  ensureLogDir();
  const text = `Your Secure Social verification code is: ${code}`;
  const logEntry = `[${new Date().toISOString()}] OTP to ${email}: ${code}\n`;
  fs.appendFileSync(LOG_PATH, logEntry, 'utf-8');

  const config = getSmtpConfig();
  if (!config) {
    return { sent: false, configured: false };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    tls: config.tls,
    auth: config.auth,
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to: email,
      subject: 'Secure Social verification code',
      text,
    });
    return { sent: true, configured: true };
  } catch (err) {
    console.error('[OTP EMAIL ERROR]', err);
    return { sent: false, configured: true, error: err.message || 'SMTP send failed' };
  }
}

module.exports = {
  sendOtpEmail,
  isSmtpConfigured,
};
