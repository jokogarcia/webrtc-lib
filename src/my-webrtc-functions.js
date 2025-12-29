import { getDb } from "./utils";

const db = getDb();
let _autoreplyEnabled = true;
/**
 * If autoreply is enabled, incoming connections will be automatically answered.
 * Otherwise, the client can use the dispatched event to handle incoming connections manually.
 * Using the replyToConnection(callId) function.
 * @param {Boolean} enabled 
 */
export function setAutoreplyEnabled(enabled) {
    _autoreplyEnabled = enabled;
}
export function getDeviceId() {
  let storedId = localStorage.getItem("device_id");
  if (!storedId) {
    localStorage.setItem("device_id", generateDeviceId());
    storedId = localStorage.getItem("device_id");
  }
  return storedId;
}
function generateDeviceId() {
  const id = getRandomDigits(5);
  return id;
  //TODO: ensure id is unique
}

function getRandomDigits(length) {
  const n = Math.floor(Math.random() * Math.pow(10, length));
  return n.toString().padStart(length, "0");
}
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc = new RTCPeerConnection(servers);
let _dataChannel = null;

/**
 *
 * @param {string} callerId The id of the caller
 * @param {string} calleeId The id of the callee
 */
export async function initiateConnection(callerId, calleeId) {
  // 1. Create the data channel
  setDataChannel(pc.createDataChannel("commands"));

  // 2. Setup Firebase refs (same as Fireship demo)
  const callDoc = db.collection("calls").doc();
  callDoc.set({ callerId, calleeId });
  const offerCandidates = callDoc.collection("offerCandidates");
  const answerCandidates = callDoc.collection("answerCandidates");

  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // 3. Create Offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // 4. Listen for Answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // Listen for remote ICE candidates
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
}

export async function replyToConnection(callId) {
  const callDoc = db.collection("calls").doc(callId);
  const peerId = (await callDoc.get()).data().callerId;
  const answerCandidates = callDoc.collection("answerCandidates");
  const offerCandidates = callDoc.collection("offerCandidates");

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  // IMPORTANT: Listen for the data channel initiated by the caller
  pc.ondatachannel = (event) => {
    setDataChannel(event.channel);
  };

  const callData = (await callDoc.get()).data();
  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
}

let _channelStatus = "closed";
/**
 *
 * @param {RTCDataChannel} channel
 */
function setDataChannel(channel) {
  _dataChannel = channel;
  _dataChannel.onopen = () => {
    document.dispatchEvent(
      new CustomEvent("data-channel-state", { detail: "open" })
    );
    _channelStatus = "open";
  };
  _dataChannel.onclose = () => {
    document.dispatchEvent(
      new CustomEvent("data-channel-state", { detail: "closed" })
    );
    _channelStatus = "closed";
  };

  _dataChannel.onmessage = (event) => {
    if (typeof event.data === "string") {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "file-info" || message.type === "file-start") {
          // Handle file metadata
          handleFileMetadata(message);
          return;
        } else if (
          message.type === "file-chunk" ||
          message.type === "file-complete"
        ) {
          // Handle file chunks
          handleFileChunk(message);
          return;
        }
      } catch (e) {
        // Regular text message
        document.dispatchEvent(
          new MessageEvent("remote-message", {
            data: event.data,
          })
        );
      }
    } else {
      // Binary data - could be file content
      handleBinaryData(event.data);
    }
  };
}
/**
 * Sends a message over the established data channel.
 * @param {any} message
 * @throws Will throw an error if the data channel is not established or not open.
 */
export function sendMessage(message) {
  if (!_dataChannel) {
    throw new Error("Data channel is not established");
  }
  if (_channelStatus !== "open") {
    throw new Error("Data channel is not open");
  }
  _dataChannel.send(message);
}
//listen for incoming calls:
db.collection("calls")
  .where("calleeId", "==", getDeviceId())
  .onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added") {
        if(_autoreplyEnabled){
            await replyToConnection(change.doc.id);
            return
        }
        console.log("Incoming call:", change.doc);
        const callDoc = db.collection("calls").doc(change.doc.id);
        const callData = (await callDoc.get()).data();
        const peerId = callData.callerId;
        document.dispatchEvent(
          new CustomEvent("incoming-call", { detail: {
            callId: change.doc.id,
            peerId: peerId
          } })
        );
      }
    });
  });

// File sending function
export async function sendFile(file) {
  if (!_dataChannel || _dataChannel.readyState !== "open") {
    throw new Error("Data channel is not open");
  }

  // For large files, you might want to implement chunking
  const MAX_CHUNK_SIZE = 16384; // 16KB chunks

  if (file.size <= MAX_CHUNK_SIZE) {
    // Small file - send directly
    const arrayBuffer = await file.arrayBuffer();
    const fileMessage = {
      type: "file",
      name: file.name,
      size: file.size,
      mimeType: file.type,
      content: arrayBuffer,
    };

    _dataChannel.send(
      JSON.stringify({
        type: "file-info",
        name: file.name,
        size: file.size,
        mimeType: file.type,
      })
    );

    _dataChannel.send(arrayBuffer);
  } else {
    // Large file - implement chunking
    await sendFileInChunks(file);
  }
}

// Function to send large files in chunks
async function sendFileInChunks(file) {
  const CHUNK_SIZE = 16384; // 16KB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Send file metadata first
  _dataChannel.send(
    JSON.stringify({
      type: "file-start",
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks: totalChunks,
    })
  );

  // Send file in chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const arrayBuffer = await chunk.arrayBuffer();

    // Send chunk with metadata
    _dataChannel.send(
      JSON.stringify({
        type: "file-chunk",
        chunkIndex: i,
        totalChunks: totalChunks,
      })
    );

    _dataChannel.send(arrayBuffer);

    // Small delay to prevent overwhelming the channel
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Send completion signal
  _dataChannel.send(
    JSON.stringify({
      type: "file-complete",
      name: file.name,
    })
  );
}

// File receiving state
let receivingFile = null;
let fileChunks = [];

function handleFileMetadata(metadata) {
  if (metadata.type === "file-info") {
    // Simple file transfer
    receivingFile = metadata;
  } else if (metadata.type === "file-start") {
    // Chunked file transfer
    receivingFile = metadata;
    fileChunks = new Array(metadata.totalChunks);
  }
}

function handleFileChunk(chunkInfo) {
  if (chunkInfo.type === "file-complete") {
    // Reconstruct file from chunks
    if (receivingFile && fileChunks.length > 0) {
      const completeFile = new Blob(fileChunks, {
        type: receivingFile.mimeType,
      });

      document.dispatchEvent(
        new MessageEvent("remote-file", {
          data: {
            name: receivingFile.name,
            size: receivingFile.size,
            type: receivingFile.mimeType,
            content: completeFile,
          },
        })
      );

      // Reset state
      receivingFile = null;
      fileChunks = [];
    }
  }
}

function handleBinaryData(arrayBuffer) {
  if (receivingFile) {
    if (receivingFile.totalChunks) {
      // This is a chunk of a larger file - will be handled by chunk system
      // Store the chunk (you'd need to track chunk index from previous message)
      fileChunks.push(arrayBuffer);
    } else {
      // Simple file transfer
      document.dispatchEvent(
        new MessageEvent("remote-file", {
          data: {
            name: receivingFile.name,
            size: receivingFile.size,
            type: receivingFile.mimeType,
            content: arrayBuffer,
          },
        })
      );
      receivingFile = null;
    }
  }
}
