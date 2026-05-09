Optimized tool selectionCollecting project details from README and key backend files to fill the report accurately.

Read [](file:///e%3A/CSE447%20Project/mern-social/README.md)

Read [](file:///e%3A/CSE447%20Project/mern-social/backend/package.json)

Read [](file:///e%3A/CSE447%20Project/mern-social/backend/routes/auth.js#1-1), lines 1 to 260

Read [](file:///e%3A/CSE447%20Project/mern-social/backend/utils/kms.js#1-1), lines 1 to 260

Read [](file:///e%3A/CSE447%20Project/mern-social/backend/utils/email.js)

Gathering remaining module details for posts and session management so the report is complete.

Searched for regex `router\.post\('/|router\.get\('/|module\.exports = router|JWT_SECRET|cookie` (`**/backend/routes/*.js`), 42 results

Read [](file:///e%3A/CSE447%20Project/mern-social/backend/routes/posts.js)

Read [](file:///e%3A/CSE447%20Project/mern-social/backend/middleware/auth.js)

## CSE447 Project Report

### Department of Computer Science and Engineering  
Course: CSE447: Cryptography and Cryptanalysis  
Semester: Spring 2026  
Project Report  
Title: Secure Encrypted Messaging and Social Platform  

Submitted To: [Instructor Name]  
Group No: 01  
Section: 01  
Submission Date: 08 May 2026  

Group Members  
1. [Member 1 Full Name] — [Member 1 Student ID]  
2. [Member 2 Full Name] — [Member 2 Student ID]  
3. [Member 3 Full Name] — [Member 3 Student ID]  

---

## Table of Contents

1. Introduction and System Overview  
2. Login and Registration Module  
3. User Data Encryption and Decryption  
4. Password Hashing and Salting  
5. Two-Factor Authentication (2FA)  
6. Key Management Module  
7. Post and Profile Management  
8. Data Storage Security  
9. Message Authentication Code (MAC)  
10. Role-Based Access Control (RBAC)  
11. Secure Session Management  
12. GitHub Repository and Project Structure  
13. Conclusion  

---

## 1. Introduction and System Overview

This report documents the design and implementation of a secure web application built for the CSE447 lab project. The system is designed as a secure messaging/social platform that protects user credentials, profile data, posts, and one-time authentication codes with strong cryptography.

The application supports:
- secure user registration and login
- RSA encryption of sensitive stored data
- ECC-based one-time password (OTP) encryption
- email-based 2FA OTP delivery
- encrypted profile and post storage
- authenticated session management with JWT cookies
- key rotation and MAC-based integrity checks

### 1.1 Project Overview

The web application is intended for registered users who want a privacy-preserving social messaging experience. Users can:
- register and login
- verify via email OTP
- create encrypted posts
- manage profiles
- send encrypted messages and friend requests
- recover accounts using a PIN

### 1.2 Technology Stack

- Backend: Node.js, Express
- Frontend: React, Vite, Tailwind CSS
- Database: MongoDB with Mongoose
- Crypto primitives: Node crypto module
- Email delivery: `nodemailer`
- Authentication: `jsonwebtoken`, `cookie-parser`
- Password hashing: `bcryptjs`

### 1.3 System Architecture Diagram

- Frontend React app ↔ Backend Express API
- Backend stores encrypted data in MongoDB
- Backend uses RSA for user/profile/posts and ECC for OTP
- JWT cookie is issued after 2FA verification
- SMTP email service is used for OTP delivery

---

## 2. Login and Registration Module

The project implements a secure registration / login pipeline with encrypted storage and OTP-based second factor.

### 2.1 Registration Flow

1. User submits username, email, password, optional phone, and recovery PIN.
2. Backend validates required fields.
3. Username is hashed with SHA-256 for lookup.
4. Password is salted and hashed using `bcryptjs`.
5. Sensitive fields (username, email, phone, profile display name, bio) are encrypted with RSA.
6. HMAC tags are generated for integrity.
7. User record is stored in MongoDB with encrypted fields and metadata.

### 2.2 Login Flow

1. User submits username and password.
2. Backend hashes username and retrieves matching user.
3. Password verification is performed with bcrypt.
4. If valid, backend generates a 6-digit OTP.
5. OTP is encrypted with ECC before storage.
6. OTP is sent by email if SMTP is configured; otherwise it is logged locally.
7. User enters the OTP and backend verifies it.
8. On success, JWT is issued and stored in an HTTP-only cookie.

### 2.3 Implementation Details

Requirement | Implementation Details
--- | ---
Login Module | Username hashed with SHA-256, password verified with `bcryptjs`, then OTP generated and encrypted with ECC.
Registration Module | Stores username, email, phone, recovery PIN, and profile data with RSA encryption and HMAC.
Data Encrypted Before Storage | username, email, phone, profile display name, profile bio, posts title/body, OTP.
Data Decrypted on Retrieval | RSA-decrypted for profile/posts, ECC-decrypted for OTP verification, safe fallback for legacy plaintext records.

---

## 3. User Data Encryption and Decryption

Sensitive user information is encrypted before storage and decrypted on retrieval.

### 3.1 Fields Encrypted

- `username`
- `email`
- `phone`
- `profile.displayName`
- `profile.bio`
- `post.title`
- `post.body`
- OTP codes stored in `Otp` documents

### 3.2 Encryption Algorithm - RSA Implementation

- Key size: 4096-bit RSA
- Padding: OAEP with SHA-256
- Implementation: custom chunking of plaintext into 446-byte blocks, encrypting each block with RSA public key, storing ciphertext as JSON array
- Integrity: each ciphertext block set is HMAC-tagged with a key stored in `key_store.json`

### 3.3 Encryption Algorithm - ECC Implementation

- Curve: `prime256v1` (NIST P-256)
- ECC is used for ephemeral key agreement
- Each OTP is encrypted by deriving a shared secret using Diffie-Hellman
- Derived key is constructed with SHA-512 expansion
- Ciphertext is XORed with the derived key, and OTP is authenticated via HMAC

### 3.4 How Both Algorithms Are Used Differently

- RSA is used for persistent user data and post content.
- ECC is used for OTP encryption and secure token exchange.
- This ensures that both asymmetric algorithms are present and the system does not rely on a single scheme for all crypto operations.

---

## 4. Password Hashing and Salting

Passwords are never stored in plaintext.

### 4.1 Hashing Algorithm Used

- `bcryptjs` with a generated salt
- Passwords are hashed using bcrypt’s adaptive function, which defends against brute-force attacks

### 4.2 Salt Generation

- Salt is generated by `bcrypt.genSaltSync(12)`
- The salt is embedded inside bcrypt’s stored hash
- Recovery PIN uses a custom salt generated via `crypto.randomBytes(16)` and stored separately

### 4.3 Verification Process

1. Retrieve stored bcrypt hash for the user
2. Compare submitted password using `bcrypt.compareSync`
3. For recovery PIN, re-hash the provided PIN with the stored salt and compare the hash

---

## 5. Two-Factor Authentication (2FA)

The system requires a second factor after password validation.

### 5.1 2FA Method

- Email OTP is used as the second factor
- OTP is generated server-side as a 6-digit code
- OTP is encrypted with ECC and stored in the database
- OTP is delivered to the user’s registered email using SMTP when configured
- If email is not configured, OTP is logged locally for testing

### 5.2 Code Snippet

```js
const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
const encrypted = eccEncrypt(otpCode);
await Otp.findOneAndUpdate(
  { user: user._id },
  {
    ciphertext: encrypted.ciphertext,
    ephemeralPublicKey: encrypted.ephemeralPublicKey,
    mac: encrypted.mac,
    keyVersion: encrypted.keyVersion,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  },
  { upsert: true, new: true }
);
const emailResult = await sendOtpEmail(email, otpCode);
```

---

## 6. Key Management Module

A dedicated module manages RSA/ECC keys and rotation.

### 6.1 Key Storage Security

- Keys are generated and stored in `backend/data/key_store.json`
- Stored keys include:
  - `rsaPublicKey`
  - `rsaPrivateKey`
  - `eccPublicKey`
  - `eccPrivateKey`
  - `macKey`
- The module also stores version metadata and previous keys to support decryption of older records

### 6.2 Key Rotation Policy

- The `rotateKeys()` function generates fresh RSA and ECC keys
- Old keys are preserved in `previousKeys`
- New data is encrypted with the latest version
- Existing records remain decryptable by retrieving prior key versions

---

## 7. Post and Profile Management

### 7.1 Post Module

- Users can create, read, update, and delete posts
- Post title and body are encrypted with RSA before storage
- Each post is HMAC-protected for integrity
- Only the author can edit or delete their own post

### 7.2 Profile Module

- Profile fields such as display name and bio are encrypted
- User profile data is decrypted when fetched for the authenticated session
- The application exposes profile management through the frontend

### 7.3 Screenshots

- Screenshots should show:
  - Post creation form
  - Post feed view
  - Profile page with encrypted profile fields displayed after decryption

---

## 8. Data Storage Security

All critical data is encrypted at rest.

### 8.1 Evidence of Encrypted Storage

- Raw MongoDB records contain ciphertext in fields like:
  - `usernameEnc`
  - `emailEnc`
  - `titleEnc`
  - `bodyEnc`
  - `ciphertext` for OTP
- HMAC tags accompany encrypted fields, ensuring integrity

---

## 9. Message Authentication Code (MAC)

### 9.1 MAC Algorithm Used

- HMAC-SHA256 is implemented using Node crypto
- Applied to all RSA ciphertext values and ECC OTP ciphertext bundles

### 9.2 Integrity Verification Flow

- On read operations, stored MAC tags are verified before decryption
- If MAC verification fails, the record is treated as corrupted
- This protects against tampering with encrypted database fields

---

## 10. Role-Based Access Control (RBAC)

### 10.1 Roles Defined

- `admin`
- `user`

### 10.2 Permission Matrix

Operation / Resource | Admin | Regular User
---|---|---
View own profile | ✔ | ✔
Edit own profile | ✔ | ✔
Create / edit posts | ✔ | ✔
Delete own post | ✔ | ✔
Delete any post | ✔ | ✘
View all user accounts | ✔ | ✘
Manage / rotate keys | ✔ | ✘
Assign roles | ✔ | ✘
View audit logs | ✔ | ✘

---

## 11. Secure Session Management

### 11.1 Token Signing / Verification

- Sessions use JWT tokens signed with `JWT_SECRET`
- Backend stores token in an HTTP-only cookie
- Each protected route uses middleware to verify token validity
- Invalid or expired tokens return `401`

---

## 12. GitHub Repository and Project Structure

GitHub Repository URL  
- `https://github.com/your-username/your-repo-name` (replace with actual repo)

### 12.1 Repository Structure

- `backend/`
  - server.js
  - `routes/`
  - `models/`
  - utils
  - data
- `frontend/`
  - `src/`
  - `components/`
  - `pages/`
  - api.js
- README.md
- .env.example

### 12.2 README Overview

README contains:
- backend/frontend setup instructions
- dependency installation commands
- environment variable setup
- notes on MongoDB and OTP email configuration
- explanation of key generation and API behavior

---

## 13. Conclusion

This project successfully implements a secure messaging and social application with multiple cryptographic layers. The system protects user data using RSA and ECC, enforces password hashing and salted recovery PINs, and delivers two-factor authentication with secure OTP handling. Key management and integrity checks have been integrated to make the platform resistant to tampering and unauthorized access.