import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Initialize Firebase
let app;
let db;
/** @type{firebase.firestore.CollectionReference} */
let devicesCollection;
/** @type{firebase.firestore.CollectionReference} */
let callsCollection;
/**
 * Initializes Firebase if not already initialized and returns the app and db instances.
 * @returns {app: firebase.app.App, db: firebase.firestore.Firestore}
 */
export function initFirebase(firebaseConfig, devicesCollectionName = "devices", callsCollectionName = "calls") {
  if (!app) {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    devicesCollection = db.collection(devicesCollectionName);
    callsCollection = db.collection(callsCollectionName);
  }
}

/**
 * Gets the Firebase database instance, initializing Firebase if not already initialized.
 * @returns {firebase.firestore.Firestore}
 */
export function getDb() {
  if (!db) initFirebase();
  return db;
}
/**
 * 
 * @returns {firebase.Firestore.CollectionReference}
 */
export function getDevicesCollection() {
  if (!devicesCollection) throw new Error("Firebase not initialized. Call initFirebase() first.");
  return devicesCollection;
}
export function getCallsCollection() {
  if (!callsCollection) throw new Error("Firebase not initialized. Call initFirebase() first.");
  return callsCollection;
}