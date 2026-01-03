export class SignalingServiceBase {
  /**
   *
   * @param {function} handleIncomingCall - Callback to handle incoming call offers.
   * @param {function} handleAnswer - Callback to handle answers to calls
   * @param {function} handleCandidate - Callback to handle incoming ICE candidates
   * @param {Promise<string>} peerIdPromise - Promise that resolves to a unique identifier of this peer across signaling service (like a phone number).
   * @param {function(string):function} listenForIncomingCalls - Server subscription function to listen for incoming calls. Returns an unsubscribe function.
   * @param {function(string,string,string):Promise<string>} createCall - Server function to create a call. Takes in the calleeId, the callerId and the JSON representation of the RTC Offer. Returns the call ID.
   * @param {function(string):function} listenForCallAnswer - Server subscription function to listen for call answers. Takes in the call ID. Returns an unsubscribe function.
   * @param {function(string):function} listenForOfferICECandidates - Server subscription function to listen for offer ICE candidates (offer that originate in the caller). Takes in the call ID. Returns an unsubscribe function.
   * @param {function(string):function} listenForAnswerICECandidates - Server subscription function to listen for answer ICE candidates (offer that originates in the callee). Takes in the call ID. Returns an unsubscribe function.
   * @param {function(string,string):Promise<void>} answerCall - Server function to post an answer to a call. Takes in the call ID and the JSON representation of the RTC Answer.
   * @param {function(string,string,boolean):Promise<void>} pushICECandidate - Server function to push ICE candidates.
   * @param {function(string):Promise<void>} disposeCall - Server function to cleanup the server side of a call (optional as far as the FE).
   */
  constructor(
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
  ) {
    this.handleIncomingCall = handleIncomingCall;
    this.handleAnswer = handleAnswer;
    this.handleCandidate = handleCandidate;
    this.unsubcribeFunctions = [];
    this.peerId = null;
    this._listenForIncomingCalls = listenForIncomingCalls;
    this._createCall = createCall;
    this._listenForCallAnswer = listenForCallAnswer;
    this._listenForOfferICECandidates = listenForOfferICECandidates;
    this._listenForAnswerICECandidates =
      listenForAnswerICECandidates;
    this._answerCall = answerCall;
    this._pushICECandidate = pushICECandidate;
    this._disposeCall = disposeCall;
    
    peerIdPromise.then((peerId) =>
        this._setPeerId(peerId)
        );
  }
  _clearSubscriptions() {
    while (this.unsubcribeFunctions.length > 0) {
      const unsubscribe = this.unsubcribeFunctions.pop();
      if (typeof unsubscribe === "function") unsubscribe();
    }
  }
  _setPeerId(peerId) {
    this._clearSubscriptions();
    this.peerId = peerId;
    this.unsubcribeFunctions.push(this._listenForIncomingCalls(peerId));
  }

  async createCall(calleeId, offer) {
    const callId = await this._createCall(calleeId, this.peerId, offer);
    this.unsubcribeFunctions.push(this._listenForCallAnswer(callId));
    this.unsubcribeFunctions.push(this._listenForAnswerICECandidates(callId));

    return callId;
  }

  async answerCall(callId, answer) {
    await this._answerCall(callId, answer);
    this.unsubcribeFunctions.push(this._listenForOfferICECandidates(callId));
  }
  async disposeCall(callId) {
    this._clearSubscriptions();
    if (this._disposeCall) await this._disposeCall(callId);
  }
  pushICECandidate = (callId, candidate, isOfferer) =>
    this._pushICECandidate(callId, candidate, isOfferer);
}

