# WebRTC Peer-to-Peer Communication Library

A simple WebRTC library for peer-to-peer communication with text messaging and file transfer capabilities, using Firebase Firestore for signaling.

## Features

- 🚀 Easy peer-to-peer connection establishment
- 💬 Real-time text messaging
- 📁 File transfer with progress tracking
- 🔄 Auto-reply for incoming connections (optional)
- 📡 Multiple concurrent connections
- 🌐 Firebase Firestore signaling
- 📊 Progress events for file transfers

## Installation

Install the package using npm/pnpm:

```bash
npm install @jokogarcia/webrtc-lib
```

**Note**: This package is hosted on the GitHub Package Registry. You may need to create an `.npmrc` file in your project root with your GitHub authentication token:

```ini
@jokogarcia:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

## Usage

First, import the library and initialize it with your Firebase configuration. This is **required** before calling any other functions.

```javascript
import { 
  initWebRTC,
  initiateConnection, 
  replyToConnection,
  sendMessage, 
  broadcastMessage,
  sendFile,
  getActiveConnections,
  setAutoreplyEnabled,
  setIceServers 
} from '@jokogarcia/webrtc-lib';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize the library
initWebRTC(firebaseConfig);
```

> **Important**: You can find your Firebase configuration/credentials in the [Firebase Console](https://console.firebase.google.com/) under Project Settings > General > Your Apps.
>
> **Security Note**: If you are using this in a client-side application, ensure your Firestore security rules are configured correctly to allow necessary access while preventing abuse. Do not commit sensitive keys if they require server-side restriction, though standard Firebase API keys are generally safe for client-side use with proper security rules.

## Basic Usage

### 1. Configure ICE Servers (Optional)

By default, the library uses Google's STUN servers. You can configure custom ICE servers:

```javascript
const customIceServers = [
  { urls: ['stun:stun.l.google.com:19302'] },
  { 
    urls: ['turn:your-turn-server.com:3478'],
    username: 'your-username',
    credential: 'your-password'
  }
];

setIceServers(customIceServers, 10);
```

### 2. Configure Auto-Reply

Control whether incoming connections are automatically answered:

```javascript
// Enable auto-reply (default)
setAutoreplyEnabled(true);

// Disable auto-reply for manual handling
setAutoreplyEnabled(false);
```

### 3. Initiate a Connection

```javascript
const callerName = "alice";
const calleeName = "bob";

try {
  await initiateConnection(callerName, calleeName);
  console.log("Connection initiated successfully");
} catch (error) {
  console.error("Failed to initiate connection:", error);
}
```

### 4. Handle Incoming Connections (Manual Mode)

When auto-reply is disabled, listen for incoming calls:

```javascript
document.addEventListener('incoming-call', async (event) => {
  const { callId, peerId } = event.detail;
  console.log(`Incoming call from ${peerId}`);
  
  // Accept the call
  try {
    await replyToConnection(callId);
    console.log("Call accepted");
  } catch (error) {
    console.error("Failed to accept call:", error);
  }
});
```

## API Reference

### Connection Management

#### `initiateConnection(callerName, calleeName)`
Initiates a WebRTC connection to another peer.
- `callerName` (string): Your identifier
- `calleeName` (string): Target peer's identifier
- Returns: Promise that resolves when connection is initiated

#### `replyToConnection(callId)`
Manually accepts an incoming connection.
- `callId` (string): The ID of the incoming call
- Returns: Promise that resolves when connection is established

#### `getActiveConnections()`
Returns an array of active connection IDs.
- Returns: `string[]` - Array of active call IDs

### Messaging

#### `sendMessage(message, callId)`
Sends a message to a specific peer.
- `message` (any): Message to send
- `callId` (string): Target connection ID
- Throws: Error if connection not found or channel not open

#### `broadcastMessage(message)`
Sends a message to all connected peers.
- `message` (any): Message to broadcast

### File Transfer

#### `sendFile(file, callId)`
Sends a file to a specific peer with progress tracking.
- `file` (File): File object to send
- `callId` (string): Target connection ID
- Returns: Promise that resolves when file is fully sent

### Configuration

#### `setAutoreplyEnabled(enabled)`
Controls automatic answering of incoming connections.
- `enabled` (boolean): Enable/disable auto-reply

#### `setIceServers(iceServers, iceCandidatePoolSize = 10)`
Configures ICE servers for NAT traversal.
- `iceServers` (RTCIceServer[]): Array of ICE server configurations
- `iceCandidatePoolSize` (number): Size of ICE candidate pool

## Events

The library dispatches custom events on the `document` object:

### Connection Events

#### `data-channel-state`
Fired when a data channel opens or closes.
```javascript
document.addEventListener('data-channel-state', (event) => {
  const { state, callId } = event.detail;
  console.log(`Channel ${callId} is now ${state}`); // 'open' or 'closed'
});
```

#### `incoming-call`
Fired when receiving an incoming connection (auto-reply disabled).
```javascript
document.addEventListener('incoming-call', (event) => {
  const { callId, peerId } = event.detail;
  console.log(`Incoming call from ${peerId}, ID: ${callId}`);
});
```

### Messaging Events

#### `remote-message`
Fired when receiving a text message.
```javascript
document.addEventListener('remote-message', (event) => {
  const { channelName, data, callId } = event.detail;
  console.log(`Message from ${channelName}: ${data}`);
});
```

### File Transfer Events

#### `file-sending-progress`
Fired during file sending to track progress.
```javascript
document.addEventListener('file-sending-progress', (event) => {
  const { transferId, fileName, fileSize, totalChunks, sentChunks } = event.detail;
  const progress = (sentChunks / totalChunks) * 100;
  console.log(`Sending ${fileName}: ${progress.toFixed(1)}%`);
});
```

#### `file-receiving-progress`
Fired during file receiving to track progress.
```javascript
document.addEventListener('file-receiving-progress', (event) => {
  const { transferId, fileName, fileSize, totalChunks, receivedChunks } = event.detail;
  const progress = (receivedChunks / totalChunks) * 100;
  console.log(`Receiving ${fileName}: ${progress.toFixed(1)}%`);
});
```

#### `remote-file`
Fired when a file is completely received.
```javascript
document.addEventListener('remote-file', (event) => {
  const { name, size, type, content } = event.detail;
  console.log(`Received file: ${name} (${size} bytes)`);
  
  // Create download link
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
});
```

## Complete Example

```javascript
import { 
  initWebRTC,
  initiateConnection, 
  sendMessage, 
  sendFile,
  getActiveConnections,
  setAutoreplyEnabled 
} from '@jokogarcia/webrtc-lib';

// 1. Initialize
initWebRTC({ /* your firebase config */ });


// Configure the library
setAutoreplyEnabled(true);

// Set up event listeners
document.addEventListener('data-channel-state', (event) => {
  const { state, callId } = event.detail;
  if (state === 'open') {
    console.log(`Connected to peer: ${callId}`);
    
    // Send a welcome message
    sendMessage('Hello from the other side!', callId);
  }
});

document.addEventListener('remote-message', (event) => {
  const { data, callId } = event.detail;
  console.log(`Received: ${data} from ${callId}`);
});

document.addEventListener('remote-file', (event) => {
  const { name, content } = event.detail;
  console.log(`Received file: ${name}`);
  
  // Auto-download received files
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Connect to a peer
async function connectToPeer() {
  try {
    await initiateConnection('alice', 'bob');
    console.log('Connection initiated');
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

// Send file function
async function sendFileToAll() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const connections = getActiveConnections();
      for (const callId of connections) {
        try {
          await sendFile(file, callId);
          console.log(`File sent to ${callId}`);
        } catch (error) {
          console.error(`Failed to send file to ${callId}:`, error);
        }
      }
    }
  };
  input.click();
}

// Example usage
connectToPeer();
```

## File Transfer Protocol

The library implements a custom file transfer protocol with the following features:

- **Chunked Transfer**: Files are split into 16KB chunks for efficient transmission
- **Progress Tracking**: Real-time progress events for both sending and receiving
- **Flow Control**: Automatic buffering management to prevent overwhelming the connection
- **Multiple Transfers**: Support for concurrent file transfers with unique transfer IDs
- **Reliability**: Chunk sequencing ensures files are reassembled correctly

### File Transfer Packet Format

```
TRANSFERID: 4 bytes        // Unique transfer identifier
FILENAME_LENGTH: 2 bytes   // Length of filename in bytes
FILESIZE: 8 bytes         // Total file size
TOTALCHUNKS: 4 bytes      // Total number of chunks
CURRENTCHUNK: 4 bytes     // Current chunk index
CONTENTSIZE: 2 bytes      // Size of chunk content
FILENAME: variable        // UTF-8 encoded filename
CONTENT: variable         // Chunk data
```

## Error Handling

The library throws errors in the following cases:

- **Connection not found**: When trying to send messages/files to non-existent connections
- **Channel not open**: When trying to send data over closed channels
- **File transfer errors**: Network issues or connection drops during file transfer

Always wrap async operations in try-catch blocks for proper error handling.

## Dependencies

- Firebase/Firestore (for signaling)
- WebRTC API (built into modern browsers)

## Browser Support

This library works in all modern browsers that support:
- WebRTC API
- RTCDataChannel
- Firebase SDK
- ES6+ features (async/await, Map, etc.)

