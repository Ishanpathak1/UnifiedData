// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyB50FwGDgVYx39uEoBjqY0hsNVb5Q0mK0w",
    authDomain: "onedata-a376a.firebaseapp.com",
    projectId: "onedata-a376a",
    storageBucket: "onedata-a376a.firebasestorage.app",
    messagingSenderId: "552541459765",
    appId: "1:552541459765:web:af437075242a14f807a87c",
    measurementId: "G-E0YVNEW3PF"
};

// Initialize Firebase only if it hasn't been initialized already
let app;
let auth;
let db;
let googleProvider;
let analytics;

// Check if we're in browser environment and Firebase isn't already initialized
if (typeof window !== 'undefined' && getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  
  // Only initialize analytics in browser environment
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.log("Analytics failed to initialize:", error);
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
}

export { auth, db, googleProvider, analytics };
