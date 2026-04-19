import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
   apiKey: "AIzaSyAjAyQ_QAkm_uJ4zD6OJhi6FtHkRK4AZzU",
  authDomain: "hirex2-db266.firebaseapp.com",
  projectId: "hirex2-db266",
  storageBucket: "hirex2-db266.firebasestorage.app",
  messagingSenderId: "841248870669",
  appId: "1:841248870669:web:1de41d8af81d7a4d9da044"
};

// Initialize Firebase safely for React Hot Reload
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
