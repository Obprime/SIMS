import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCFW4WMIvJjbFiyeym7I6OCk_FPAovAMIE",
  authDomain: "payg-6219f.firebaseapp.com",
  projectId: "payg-6219f",
  storageBucket: "payg-6219f.firebasestorage.app",
  messagingSenderId: "340280657976",
  appId: "1:340280657976:web:b4e80a90254bb616aefecd",
  measurementId: "G-YQ9CL0WR8G",
};

const requiredEnvValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

const hasMissingValue = requiredEnvValues.some((value) => !value);
const hasPlaceholderValue = requiredEnvValues.some(
  (value) => typeof value === "string" && value.startsWith("your_")
);

export const firebaseConfigError = hasMissingValue || hasPlaceholderValue
  ? "Firebase config is missing or still using placeholder values in .env."
  : null;

const app = firebaseConfigError ? null : initializeApp(firebaseConfig);

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
