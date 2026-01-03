import { getCallsCollection } from "./init-firebase";
import { SignalingServiceBase } from "./signaling-service-base";
export class FirebaseSignalingService extends SignalingServiceBase {
  /**
   *
   * @param {function} handleIncomingCall - Callback to handle incoming call offers.
   * @param {function} handleAnswer - Callback to handle answers to calls
   * @param {function} handleCandidate - Callback to handle incoming ICE candidates
   * @param {Promise<string>} peerIdPromise - Promise that resolves to a unique identifier of 
   * this peer across signaling service (like a phone number).
   */
  constructor(
    handleIncomingCall,
    handleAnswer,
    handleCandidate,
    peerIdPromise,
  ) {
    
    
    const listenForIncomingCalls = (peerId) => {
      return getCallsCollection()
        .where("calleeId", "==", peerId)
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              handleIncomingCall(change.doc.id, data.offer);
            }
          });
        });
    };
    const createCall = async (calleeId, callerId, offer) => {
        const callDoc = getCallsCollection().doc();
        const callId = callDoc.id;
        
        await callDoc.set({
            callerId,
            calleeId,
            offer
          });
          console.log("Call created with ID:", callId, "from", callerId, "to", calleeId," offer:", typeof offer);
          return callId;
    };
    const listenForCallAnswer = (callId) => {
      console.log("Listening for call answer for callId:", callId);
        return getCallsCollection().doc(callId).onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (data.answer) {
              console.log("Received answer for callId:", callId, " answer:", typeof data.answer, data.answer);
              handleAnswer(callId, data.answer);
            }
          });
    };
    const listenForOfferICECandidates = (callId) => {
        const callDoc = getCallsCollection().doc(callId);
        const candidatesCollection = callDoc.collection("offerCandidates");
        return candidatesCollection.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const data = change.doc.data();
                handleCandidate(callId, data.candidate);
              }
            });
          });
    };
    const listenForAnswerICECandidates = (callId) => {
        const callDoc = getCallsCollection().doc(callId);
        const candidatesCollection = callDoc.collection("answerCandidates");
        return candidatesCollection.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const data = change.doc.data();
                handleCandidate(callId, data.candidate);
              }
            });
          });
    };
    const answerCall = (callId, answer) => {
      console.log("Answering call with ID:", callId, " answer:", typeof answer);
        const callDoc = getCallsCollection().doc(callId);
        return callDoc.update({ answer });
    };
    const pushICECandidate = (callId, candidate, isOfferer) => {
        const callDoc = getCallsCollection().doc(callId);
        const candidatesCollection = isOfferer
          ? callDoc.collection("offerCandidates")
          : callDoc.collection("answerCandidates");
        return candidatesCollection.add({ candidate });
    };
    const disposeCall = async (callId) => {
        const callDoc = getCallsCollection().doc(callId);
        callDoc.update({ disposed: true });
        // No direct recursive deletion in Firestore, so we just mark it as disposed.
        // A serverless function or server-side process should clean up old call documents periodically, including their subcollections.
    };
    super(
      handleIncomingCall,
      handleAnswer,
      handleCandidate,
      peerIdPromise,
      listenForIncomingCalls,
      createCall,
      listenForCallAnswer,
      listenForOfferICECandidates,
      listenForAnswerICECandidates,
      answerCall,
      pushICECandidate,
      disposeCall
    );
    
  }
}