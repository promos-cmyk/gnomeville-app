// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCglgDAKnTL11joL95Zdit3e9MtCIF-yXY",
  authDomain: "gnomeville-3b0b8.firebaseapp.com",
  projectId: "gnomeville-3b0b8",
  storageBucket: "gnomeville-3b0b8.firebasestorage.app",
  messagingSenderId: "560492884817",
  appId: "1:560492884817:web:fd937a55e333b352aa1970",
  measurementId: "G-4DTFQRNP3G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics is only available in browser environments
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    // analytics may fail to initialize (for example in some dev environments)
    // we silently ignore the error but still export `analytics` as null.
    // console.warn('Firebase analytics not initialized', e);
  }
}

// Export app, analytics and the raw config for convenience
export { app, analytics, firebaseConfig };
export default app;