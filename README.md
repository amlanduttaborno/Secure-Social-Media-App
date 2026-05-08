# Secure Social MERN App

A secure web application built with Node.js, Express, MongoDB, React, and Tailwind CSS.
The application implements encrypted user storage, RSA/ECC cryptography, HMAC integrity checks, JWT session cookies, email OTP-based 2FA, encrypted posts, friend requests, and secure messaging.

## Project overview

- `backend/` — Express API, MongoDB models, authentication, user/friend/message routes, key management and email OTP delivery
- `frontend/` — React + Vite app with Tailwind CSS, login/register UI, profile, friends, and chat interfaces

## Features

- Secure registration and login
- Password hashing with bcrypt
- Username/email/phone/profile encryption with RSA
- OTP encryption and verification using ECC
- Email delivery of OTP codes via SMTP
- Encrypted posts with HMAC integrity validation
- Friend requests and encrypted message support
- JWT-based session management in HTTP-only cookies
- Recovery PIN support and key rotation

## Setup

### 1. Backend setup

1. Open a terminal in `mern-social/backend`
2. Copy `.env.example` to `.env`
3. Edit `.env` and set:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `FRONTEND_URL`
   - `SMTP_SERVER` / `SMTP_PORT`
   - `SMTP_USERNAME` / `SMTP_PASSWORD`
   - `EMAIL_FROM`
   - `SMTP_SECURE`, `SMTP_TLS`, `SMTP_REJECT_UNAUTHORIZED`
4. Install dependencies:

```powershell
npm install
```

5. Start the backend:

```powershell
npm run dev
```

### 2. Frontend setup

1. Open a terminal in `mern-social/frontend`
2. Install dependencies:

```powershell
npm install
```

3. Start the frontend:

```powershell
npm run dev
```

4. Open the browser at the port shown by Vite (default `http://localhost:5173`).

## Environment variables

The backend reads `.env` either from `backend/.env` or from the workspace root `.env`.

Example configuration:

```env
MONGO_URI=mongodb://127.0.0.1:27017/secure-social
JWT_SECRET=replace_with_a_strong_secret
FRONTEND_URL=http://localhost:5173
PORT=4000

SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password
EMAIL_FROM=your_email@gmail.com
SMTP_SECURE=false
SMTP_TLS=true
SMTP_REJECT_UNAUTHORIZED=false
```

## Gmail SMTP setup

To deliver OTP by email through Gmail:

1. Enable 2-Step Verification for your Google account.
2. Create an App Password for Mail.
3. Use that app password for `SMTP_PASSWORD`.
4. Set `SMTP_SERVER` to `smtp.gmail.com` and `SMTP_PORT` to `587`.
5. Set `SMTP_SECURE=false`, `SMTP_TLS=true`, and `SMTP_REJECT_UNAUTHORIZED=false`.

If the backend logs a Gmail authentication error such as `535-5.7.8 Username and Password not accepted`, the app password or username is incorrect or the account is not configured for SMTP access.

## Application behavior

- The backend auto-generates RSA and ECC keys in `backend/data/key_store.json` on first run.
- OTP codes are encrypted and stored in MongoDB before verification.
- If SMTP is not configured, OTPs are logged locally to `backend/data/otp_email_log.txt` for testing.
- The frontend uses `VITE_API_URL` or `http://localhost:4000` to call the backend.

## Testing and usage

- Register a new user using the frontend registration form.
- Login with username and password.
- If email delivery is configured correctly, the OTP is sent to the registered email.
- Enter the OTP to complete login and establish a session.
- Use the Friends and Chat UI to interact with contacts.

## Notes

- Keep `JWT_SECRET` secret and strong.
- Use an app-specific SMTP password rather than a normal Gmail password.
- If OTP email delivery fails, check the backend console for `[OTP EMAIL ERROR]` and verify SMTP credentials.
- The system is designed to encrypt sensitive user fields and verify integrity with HMAC before decryption.

## Repository structure

- `backend/`
  - `server.js`
  - `routes/`
  - `models/`
  - `utils/`
  - `middleware/`
  - `data/`
- `frontend/`
  - `src/`
  - `components/`
  - `pages/`
  - `api.js`
- `backend/.env.example`

## Troubleshooting

- If the backend fails to start on port `4000`, ensure no other process is listening on that port.
- If OTP email is not delivered, verify SMTP settings and app password.
- If login returns `Invalid credentials`, confirm the username and password are correct.
- Ensure MongoDB is running and accessible at `MONGO_URI`.
