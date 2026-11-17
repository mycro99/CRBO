import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-auth.js';
import * as firestore from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-firestore.js';
import {createFleetStore} from './fleet-store.js?v=2';
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp({apiKey:'AIzaSyBa95NS-_TApkErWgkfhTzRhOyKss5W2aU',authDomain:'listing-44b2b.firebaseapp.com',projectId:'listing-44b2b',storageBucket:'listing-44b2b.firebasestorage.app',messagingSenderId:'310030019842',appId:'1:310030019842:web:c8a50b61f3dfbcb867e61b'});
export const auth=getAuth(app);
export const store=createFleetStore(firestore,firestore.getFirestore(app),auth);
export const watchAuth=next=>onAuthStateChanged(auth,next);
