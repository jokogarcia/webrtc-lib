import { getCallsCollection } from "./init-firebase";



export class SignalingService {
  /**
   *
   * @param {function} handleIncomingCall - Callback to handle incoming call offers.
   * @param {function} handleAnswer - Callback to handle answers to calls
   * @param {function} handleCandidate - Callback to handle incoming ICE candidates
   * @param {string | Promise<string>} peerId - Optional promise that resolves to the peer ID. At least one of peerId or peerIdPromise must be provided.
   */
  constructor(handleIncomingCall, handleAnswer, handleCandidate, peerId = "") {
      
    this.callsCollection = getCallsCollection();
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
    const batch = this.callsCollection.firestore.batch();

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
