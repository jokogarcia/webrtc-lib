import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { firebaseConfig } from './firebase.js';

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

export class SignalingService {
  /**
   *
   * @param {function} handleIncomingCall - Callback to handle incoming call offers.
   * @param {function} handleAnswer - Callback to handle answers to calls
   * @param {function} handleCandidate - Callback to handle incoming ICE candidates
   * @param {string | Promise<string>} peerId - Optional promise that resolves to the peer ID. At least one of peerId or peerIdPromise must be provided.
   */
  constructor(handleIncomingCall, handleAnswer, handleCandidate, peerId = "") {
    this.db = getDb();
    this.callsCollection = this.db.collection("calls");
    this.handleIncomingCall = handleIncomingCall;
    this.handleAnswer = handleAnswer;
    this.handleCandidate = handleCandidate;
    if(typeof peerId === "string" && peerId !== "") {
      this._setPeerId(peerId);
    }else if (peerId instanceof Promise) {
      peerId.then((id) => {
        this._setPeerId(id);
      }).catch((error) => {
        console.error("Failed to set peer ID from promise:", error);
      });
    } else {
      throw new Error("Either peerId or peerIdPromise must be provided.");
    }
  }

  _setPeerId(peerId) {
    if (this.incomingCallUnsubscribe) {
      this.incomingCallUnsubscribe();
    }
    this.peerId = peerId;
    this.incomingCallUnsubscribe = this.callsCollection
      .where("calleeId", "==", this.peerId)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            this.handleIncomingCall(change.doc.id, data.offer);
          }
        });
      });
  }

  async createCall(calleeId, offer) {
    const callDoc = this.callsCollection.doc();
    const callId = callDoc.id;
    
    callDoc.set({
        callerId:this.peerId,
        calleeId,
        offer
      });
    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.answer) {
        this.handleAnswer(callId,data.answer);
      }
    });

    // Listen for remote ICE candidates
    callDoc.collection("answerICECandidates").onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = change.doc.data();
          this.handleCandidate(callId,candidate);
        }
      });
    });

    return callId;
  }

  async answerCall(callId, answer) {
    const callDoc = this.callsCollection.doc(callId);

    // Save the answer to the call document
    await callDoc.update({ answer });

    // Listen for remote ICE candidates
    callDoc.collection("offerICECandidates").onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = change.doc.data();
          this.handleCandidate(callId,candidate);
        }
      });
    });
  }
  async disposeCall(callId) {
    if(this.incomingCallUnsubscribe) {
      this.incomingCallUnsubscribe();
    }
    const callDoc = this.callsCollection.doc(callId);

    // Delete subcollections properly
    const batch = this.db.batch();

    const offerICECandidates = await callDoc
      .collection("offerICECandidates")
      .get();
    offerICECandidates.forEach((doc) => batch.delete(doc.ref));

    const answerICECandidates = await callDoc
      .collection("answerICECandidates")
      .get();
    answerICECandidates.forEach((doc) => batch.delete(doc.ref));

    batch.delete(callDoc);
    await batch.commit();
  }
  pushICECandidate(callId, candidate, isOfferer) {
    const callDoc = this.callsCollection.doc(callId);
    const collectionName = isOfferer
      ? "offerICECandidates"
      : "answerICECandidates";
    return callDoc.collection(collectionName).add(candidate.toJSON());
  }
        
}
//Device ID management code
const ID_KEY = "my-webrtc-device-id";
let getDeviceIdPromise = null;
export async function getDeviceId() {
  if (getDeviceIdPromise) return getDeviceIdPromise;

  getDeviceIdPromise = (async () => {
    let storedId = localStorage.getItem(ID_KEY);
    if (!storedId) {
      const newId = await generateDeviceId();
      localStorage.setItem(ID_KEY, JSON.stringify(newId));
      storedId = JSON.stringify(newId);
    }
    if (storedId && typeof storedId === "string") {
      return JSON.parse(storedId);
    }
    throw new Error("Failed to get device ID from local storage");
  })();

  return getDeviceIdPromise;
}
async function displayNameIsTaken(displayName) {
  const db = getDb();
  const querySnapshot = await db
    .collection("devices")
    .where("displayName", "==", displayName)
    .get();
  return !querySnapshot.empty;
}
async function generateDeviceId() {
  const db = getDb();
  let displayName = getRandomDigits(5);
  while (await displayNameIsTaken(displayName)) {
    displayName = getRandomDigits(5);
  }
  const deviceDoc = db.collection("devices").doc();
  const deviceDocId = deviceDoc.id;
  let id = {
    uuid: deviceDocId,
    displayName,
  };
  await deviceDoc.set(id);
  return id;
}
function getRandomDigits(length) {
  const n = Math.floor(Math.random() * Math.pow(10, length));
  return n.toString().padStart(length, "0");
}
export async function setDeviceDisplayName(newName) {
  if (!newName || typeof newName !== "string" || newName.trim() === "") {
    throw new Error("EMPTY");
  }
  if (newName.includes("-<>-")) {
    throw new Error("CONTAINS_SEPARATOR");
  }
  if (await displayNameIsTaken(newName)) {
    throw new Error("TAKEN");
  }
  const db = getDb();
  const deviceId = await getDeviceId();
  const deviceDoc = db.collection("devices").doc(deviceId.uuid);
  await deviceDoc.update({ displayName: newName });
  const updatedId = {
    ...deviceId,
    displayName: newName,
  };
  localStorage.setItem(ID_KEY, JSON.stringify(updatedId));
  return updatedId;
}