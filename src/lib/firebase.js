import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyAL0bG-TU34Yf9OVoW_Rglx3UiecyFtzKA",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "autoshopassistpro.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "autoshopassistpro",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "autoshopassistpro.firebasestorage.app",
  appId: env.VITE_FIREBASE_APP_ID || "1:1083885233883:web:dfa39e98683703253c4efe",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
