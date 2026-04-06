import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDNa0cFVEHt3anbT12tKZTPWM-Z3QfKjgg",
  authDomain: "sharfin-s-trade-ai.firebaseapp.com",
  projectId: "sharfin-s-trade-ai",
  storageBucket: "sharfin-s-trade-ai.firebasestorage.app",
  messagingSenderId: "837624643924",
  appId: "1:837624643924:web:540b860c7ecfdb789088c1",
  measurementId: "G-KNFB9J81N9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
