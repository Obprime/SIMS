# SIM Registration Collection Portal

React + Firebase app with:

- Email/password login
- Agent dashboard with barcode scanner and strict form validation
- Admin portal with reporting overview
- Firestore-backed submissions

## 1. Install

```bash
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env` and set Firebase values:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## 3. Firebase setup

1. Create Firebase project.
2. Enable Authentication -> Email/Password.
3. Create Firestore database.
4. Add at least one user in Auth.
5. Create Firestore document in `users/{uid}` with role:
   - `role: "admin"` for admin users
   - `role: "agent"` for normal users

## 4. Run

```bash
npm run dev
```

## Firestore data model

### Collection: `users`
- Document ID: auth UID
- Fields:
  - `role`: `admin` or `agent`

### Collection: `reports`
- Fields:
  - `serialNumber`
  - `customerName`
  - `phoneNumber`
  - `idNumber`
  - `submittedByUid`
  - `submittedByEmail`
  - `submittedAt`

## Basic Firestore security rule starter

Use this as a starting point and tighten as needed:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    match /reports/{reportId} {
      allow read, write: if request.auth != null;
    }
  }
}
```
