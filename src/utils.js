
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { firebaseConfig } from './firebase.js';

// Polyfill window.firebase for legacy/compat support in other files
window.firebase = firebase;

export { firebase };


// Initialize Firebase
let app;
let db;
/**
 * Initializes Firebase if not already initialized and returns the app and db instances.
 * @returns {app: firebase.app.App, db: firebase.firestore.Firestore}
 */
export function initFirebase() {
  if (!app) {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }
  return { app, db };
}

/**
 * Gets the Firebase database instance, initializing Firebase if not already initialized.
 * @returns {firebase.firestore.Firestore}
 */
export function getDb() {
  if (!db) initFirebase();
  return db;
}

// WebRTC Configuration
export const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
