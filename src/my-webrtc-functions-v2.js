import { SignalingService, getDeviceId } from "./services/firebase-signaling-service.js";


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

let servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
/**
 * If used, it should be called before initiating any connections.
 * Otherwise, the default STUN servers will be used.
 * 
 * @param {RTCIceServer[]} iceServers
 * @param {number} iceCandidatePoolSize
 */
export function setIceServers(iceServers, iceCandidatePoolSize=10) {
  servers.iceServers = iceServers;
  servers.iceCandidatePoolSize = iceCandidatePoolSize;
}

// Store multiple peer connections: callId -> { pc, dataChannel }
const peerConnections = new Map();

function handleIncomingCall(callId, offer) {
  if (_autoreplyEnabled) {
    replyToConnection(callId,offer);
    return;
  }
  const peerId = offer.callerId;
  document.dispatchEvent(
    new CustomEvent("incoming-call", {
      detail: {
        callId: callId,
        peerId: peerId,
      },
    })
  );
}
/**
 * Called when a caller receives an answer from the callee.
 * @param {string} callId 
 * @param {*} answer 
 */
function handleAnswer(callId, answer) {
  const connection = peerConnections.get(callId);
  if (connection) {
    const remoteDesc = new RTCSessionDescription(answer);
    connection.pc.setRemoteDescription(remoteDesc);
  }
}
function handleCandidate(callId, candidate) {
  const connection = peerConnections.get(callId);
  if (connection) {
    connection.pc.addIceCandidate(candidate);
  }
}

const signalingService = new SignalingService(
  handleIncomingCall, 
  handleAnswer, 
  handleCandidate,
  getDeviceId().then(idObj=>idObj.displayName)
);

/**
 *
 * @param {string} callerName The id of the caller
 * @param {string} calleeName The id of the callee
 */
export async function initiateConnection(calleeName) {
  // 1. Create new peer connection for this call
  const pc = new RTCPeerConnection(servers);
  const callerName = (await getDeviceId()).displayName;
  
  
  // Create data channel
  const dataChannel = pc.createDataChannel(`${callerName}-<>-${calleeName}`);

  // 2. Create Offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);
  const callId = await signalingService.createCall(calleeName, offerDescription);
  // Store this connection
  peerConnections.set(callId, { pc, dataChannel });
  setDataChannel(dataChannel, callId);
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      signalingService.pushICECandidate(callId, event.candidate,true);
    }
  }
  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };


  //Listen for data channel initiated by the callee
  pc.ondatachannel = (event) => {
    const dataChannel = event.channel;
    peerConnections.set(callId, { pc, dataChannel });
    setDataChannel(dataChannel, callId);
  }
}

export async function replyToConnection(callId, offer) {
  // Create new peer connection for this call
  const pc = new RTCPeerConnection(servers);
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      signalingService.pushICECandidate(callId, event.candidate,false);
    }
  };
    // Listen for the data channel initiated by the caller
  pc.ondatachannel = (event) => {
    const dataChannel = event.channel;
    // Store this connection
    peerConnections.set(callId, { pc, dataChannel });
    setDataChannel(dataChannel, callId);
  };
  await pc.setRemoteDescription(offer);

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await signalingService.answerCall(callId, answer);
}

/**
 *
 * @param {RTCDataChannel} channel
 * @param {string} callId
 */
function setDataChannel(channel, callId) {
  channel.onopen = () => {
    document.dispatchEvent(
      new CustomEvent("data-channel-state", {
        detail: { state: "open", callId },
      })
    );
  };
  channel.onclose = () => {
    document.dispatchEvent(
      new CustomEvent("data-channel-state", {
        detail: { state: "closed", callId },
      })
    );
    // Clean up when channel closes
    peerConnections.delete(callId);
  };
  if (channel.label.includes("-file-")) {
    // File transfer channel
    channel.onmessage = async (event) => {
      await handleFileChunk(event.data);
    };
    return;
  }
  channel.onmessage = (event) => {
    /** @type {string} */
    const channelName = channel.label;
    if (typeof event.data === "string") {
      // Regular text message
      document.dispatchEvent(
        new CustomEvent("remote-message", {
          detail: {
            channelName,
            data: event.data,
            callId,
          },
        })
      );
    } else if (typeof event.data === "file") {
      // Binary data - could be file content
      handleFileData(event.data, channelName, callId);
    }
  };
}
/**
 * Sends a message over a specific data channel.
 * @param {any} message
 * @param {string} callId
 * @throws Will throw an error if the data channel is not established or not open.
 */
export function sendMessage(message, callId) {
  const connection = peerConnections.get(callId);
  if (!connection) {
    throw new Error(`No connection found for callId: ${callId}`);
  }
  if (connection.dataChannel.readyState !== "open") {
    throw new Error("Data channel is not open");
  }
  connection.dataChannel.send(message);
}

/**
 * Broadcasts a message to all open data channels.
 * @param {any} message
 */
export function broadcastMessage(message) {
  for (const [callId, connection] of peerConnections) {
    if (connection.dataChannel.readyState === "open") {
      connection.dataChannel.send(message);
    }
  }
}

/**
 * Gets all active connection IDs
 * @returns {string[]}
 */
export function getActiveConnections() {
  return Array.from(peerConnections.keys()).filter((callId) => {
    const connection = peerConnections.get(callId);
    return connection && connection.dataChannel.readyState === "open";
  });
}


// File sending function
export async function sendFile(file, callId) {
  const connection = peerConnections.get(callId);

  if (!connection) {
    throw new Error(`No connection found for callId: ${callId}`);
  }
  //create a new data channel for file transfer
  const pc = connection.pc;
  const fileChannel = pc.createDataChannel(
    `${connection.dataChannel.label}-file-${file.name}`
  );
  return new Promise((resolve, reject) => {
    fileChannel.onopen = () => {
      _doFileSend(fileChannel, file)
        .then(() => {
          fileChannel.close();
          resolve();
        })
        .catch(reject);
    };
    fileChannel.onerror = (error) => {
      reject(error);
    };
  });
}

/**
 *
 * @param {RTCDataChannel} channel
 * @param {File} file
 */
async function _doFileSend(channel, file) {
  const chunkSize = 16384; // 16KB
  const MAX_BUFFER = 65536; // 64KB
  const totalChunks = Math.ceil(file.size / chunkSize);
  /* PACKET FORMAT
    TRANSFERID: 4 bytes
    FILENAME_LENGTH: 2 bytes
    FILESIZE: 8 bytes
    TOTALCHUNKS: 4 bytes
    CURRENTCHUNK: 4 bytes
    CONTENTSIZE: 2 bytes // HARD max is 16384
    FILENAME: variable    //header size is 24 bytes + FILENAME_LENGTH
    CONTENT: variable
  */
  const transferId = Math.floor(Math.random() * 0xffffffff);
  let offset = 0;
  let chunkIndex = 0;
  const fileNameBytes = new TextEncoder().encode(file.name);
  const fileNameLength = fileNameBytes.length;

  while (offset < file.size) {
    while (channel.bufferedAmount > MAX_BUFFER) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const chunk = file.slice(offset, offset + chunkSize);
    const reader = new FileReader();
    const header = new ArrayBuffer(24 + fileNameLength);
    const headerView = new DataView(header);
    headerView.setUint32(0, transferId); // Transfer ID
    headerView.setUint16(4, fileNameLength); // Filename length
    headerView.setBigUint64(6, BigInt(file.size)); // File size
    headerView.setUint32(14, totalChunks); // Total chunks
    headerView.setUint32(18, chunkIndex); // Current chunk index
    headerView.setUint16(22, chunk.size); // Content size
    // Write filename
    new Uint8Array(header, 24).set(fileNameBytes);
    // Read chunk and send
    await new Promise((resolve, reject) => {
      reader.onload = () => {
        const content = new Uint8Array(reader.result);
        // Combine header and content
        const packet = new Uint8Array(header.byteLength + content.byteLength);
        packet.set(new Uint8Array(header), 0);
        packet.set(content, header.byteLength);
        channel.send(packet);
        document.dispatchEvent(
          new CustomEvent("file-sending-progress", {
            detail: {
              transferId,
              fileName: file.name,
              fileSize: file.size,
              totalChunks,
              sentChunks: chunkIndex + 1,
            },
          })
        );
        resolve();
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });
    offset += chunkSize;
    chunkIndex++;
  }
}
class OngoingFileTransfer {
  constructor(transferId, fileName, fileSize, totalChunks) {
    this.transferId = transferId;
    this.fileName = fileName;
    this.fileSize = fileSize;
    this.totalChunks = totalChunks;
    this.receivedChunks = 0;
    this.chunks = [];
  }

  addChunk(chunkIndex, content) {
    this.chunks[chunkIndex] = content;
    this.receivedChunks++;
  }

  isComplete() {
    return this.receivedChunks === this.totalChunks;
  }

  assembleFile() {
    const blobParts = this.chunks.map((chunk) => new Uint8Array(chunk));
    return new Blob(blobParts);
  }
}
/** @type {Map<number, OngoingFileTransfer>} */
const _ongoingTransfers = new Map();

async function handleFileChunk(data) {
  const dataView = new DataView(data);
  const transferId = dataView.getUint32(0);
  const fileNameLength = dataView.getUint16(4);
  const fileSize = Number(dataView.getBigUint64(6));
  const totalChunks = dataView.getUint32(14);
  const currentChunk = dataView.getUint32(18);
  const contentSize = dataView.getUint16(22);
  const fileNameBytes = new Uint8Array(
    data,
    24,
    fileNameLength
  );
  const fileName = new TextDecoder().decode(fileNameBytes);
  const content = new Uint8Array(
    data,
    24 + fileNameLength,
    contentSize
  );
  let transfer = _ongoingTransfers.get(transferId);
  if (!transfer) {
    transfer = new OngoingFileTransfer(
      transferId,
      fileName,
      fileSize,
      totalChunks
    );
    _ongoingTransfers.set(transferId, transfer);
  }
  transfer.addChunk(currentChunk, content.slice());
  document.dispatchEvent(
    new CustomEvent("file-receiving-progress", {
      detail: {
        transferId,
        fileName,
        fileSize,
        totalChunks,
        receivedChunks: transfer.receivedChunks,
      },
    })
  );
  if (transfer.isComplete()) {
    const fileBlob = transfer.assembleFile();
    document.dispatchEvent(
      new CustomEvent("remote-file", {
        detail: {
          name: transfer.fileName,
          size: transfer.fileSize,
          type: fileBlob.type,
          content: fileBlob,
        },
      })
    );
    _ongoingTransfers.delete(transferId);
  }

}

async function handleFileData(data, channelName, callId) {
  const name = data.name;
  const size = data.size;
  const type = data.type;
  const content = await data.arrayBuffer();

  document.dispatchEvent(
    new CustomEvent("remote-file", {
      detail: {
        name,
        size,
        type,
        content,
        channelName,
        callId,
      },
    })
  );
}
