// Same project, SDK version and authentication session as the existing CRBO portal.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-auth.js';
import * as firestore from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-firestore.js';
import { createInventoryStore } from './inventory-store.js?v=4';

const config = {
  apiKey:'AIzaSyBa95NS-_TApkErWgkfhTzRhOyKss5W2aU',
  authDomain:'listing-44b2b.firebaseapp.com',
  projectId:'listing-44b2b',
  storageBucket:'listing-44b2b.firebasestorage.app',
  messagingSenderId:'310030019842',
  appId:'1:310030019842:web:c8a50b61f3dfbcb867e61b',
  measurementId:'G-419VVR3NHE'
};
const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(config);
export const auth = getAuth(app);
export const store = createInventoryStore(firestore,firestore.getFirestore(app),auth);
export const watchAuth = next => onAuthStateChanged(auth,next);
