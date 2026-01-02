import "./style.css";
import { getDeviceId, setDeviceDisplayName } from "./firebase-signaling-service.js";
import {
  initiateConnection,
  broadcastMessage,
  getActiveConnections,
  sendFile,
} from "./my-webrtc-functions-v2.js";

document.querySelector("#app").innerHTML = `
<style>
  #messages {
    border: 1px solid #ccc;
    height: 200px;
    overflow-y: scroll;
    padding: 5px;
    margin-bottom: 10px;
  }
  .my-message {
    text-align: right;
    background-color: #00008b;
  }
  .peer-message {
    text-align: left;
    background-color: darkgreen;
  }
  .validation-error {
    color: red;
    font-size: 0.9em;
    margin-top: 0px;
    display: block;
  }
  .hidden {
    display: none;
  }
</style>
  <div>
    <label for="display-name-input">My Name:</label>
    <input type="text" id="display-name-input" /><p class="validation-error hidden" id="display-name-input-error" ></p>
    <button id="set-name-btn">Set Name</button>
    <h2>Peer ID: <span id="peer-id"></span></h2>
    <label for="remote-id">Remote Peer ID:</label>
    <input type="text" id="remote-id" inputmode="numeric" />
    <button id="connect-btn" disabled>Connect</button>
    <div id="status"></div>
    <div id="messages"></div>
    <input type="text" id="message-input" placeholder="Type a message..." />
    <button id="send-btn" disabled>Send</button>
    <input type="file" id="file-input" /><button id="send-file-btn" disabled>Send File</button>
  </div>
`;
const displayNameInput = document.getElementById("display-name-input");
const displayNameInputError = document.getElementById(
  "display-name-input-error"
);
const setNameBtn = document.getElementById("set-name-btn");
const peerIdSpan = document.getElementById("peer-id");
const remoteIdInput = document.getElementById("remote-id");
const connectBtn = document.getElementById("connect-btn");
const statusDiv = document.getElementById("status");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("file-input");
const sendFileBtn = document.getElementById("send-file-btn");
let dataChannelStatus = "closed";
let currentDisplayName = "";
let activeConnections = getActiveConnections();
getDeviceId().then((id) => {
  displayNameInput.value = id.displayName;
  currentDisplayName = id.displayName;
});
displayNameInput.addEventListener("input", () => {
  setNameBtn.disabled =
    displayNameInput.value.trim() === "" ||
    displayNameInput.value.trim() === currentDisplayName;
});
setNameBtn.addEventListener("click", async () => {
  const newName = displayNameInput.value.trim();
  if (newName && newName !== currentDisplayName) {
    try {
      const updatedId = await setDeviceDisplayName(newName);
      currentDisplayName = updatedId.displayName;
      setNameBtn.disabled = true;
      displayNameInputError.classList.add("hidden");
    } catch (error) {
      if (error.message === "TAKEN") {
        displayNameInputError.classList.remove("hidden");
        displayNameInputError.textContent =
          "Display name is already taken. Please choose another one.";
      } else if (error.message === "EMPTY") {
        displayNameInputError.classList.remove("hidden");
        displayNameInputError.textContent = "Display name cannot be empty.";
      } else if (error.message === "CONTAINS_SEPARATOR") {
        displayNameInputError.classList.remove("hidden");
        displayNameInputError.textContent =
          'Display name cannot contain the sequence "-<>-". Please choose another one.';
      } else {
        console.error("Failed to set display name:", error);
        displayNameInputError.classList.remove("hidden");
        displayNameInputError.textContent =
          "Failed to set display name. Please try again.";
      }
    }
  }
});
displayNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !setNameBtn.disabled) {
    setNameBtn.click();
  }
});
document.addEventListener("data-channel-state", (event) => {
  activeConnections = getActiveConnections();
  dataChannelStatus = activeConnections.length > 0 ? "open" : "closed";
  statusDiv.textContent = `Data Channel is ${dataChannelStatus}`;
  sendBtn.disabled =
    messageInput.value.trim() === "" || dataChannelStatus !== "open";
});
remoteIdInput.addEventListener("input", () => {
  connectBtn.disabled = remoteIdInput.value.trim() === "";
});
remoteIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !connectBtn.disabled) {
    connectBtn.click();
  }
});
connectBtn.addEventListener("click", async () => {
  const remoteName = remoteIdInput.value.trim();
  peerIdSpan.textContent = remoteName;
  statusDiv.textContent = "Connecting...";
  await initiateConnection(remoteName);
});
document.addEventListener("remote-message", (event) => {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("peer-message");

  const names = event.detail.channelName.split("-<>-");
  const senderName =
    names.filter((n) => n !== currentDisplayName)[0] || "Unknown";
  msgDiv.innerHTML = `<span class="sender-name">${senderName}:</span> ${event.detail.data}`;
  messagesDiv.appendChild(msgDiv);
});
messageInput.addEventListener("input", () => {
  sendBtn.disabled =
    messageInput.value.trim() === "" || dataChannelStatus !== "open";
});
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendBtn.click();
  }
});
sendBtn.addEventListener("click", () => {
  const message = messageInput.value.trim();
  try {
    broadcastMessage(message);
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("my-message");
    msgDiv.textContent = message;
    messagesDiv.appendChild(msgDiv);
    messageInput.value = "";
    sendBtn.disabled = true;
  } catch (error) {
    console.error("Failed to send message:", error);
  }
});

fileInput.addEventListener("change", () => {
  sendFileBtn.disabled =
    fileInput.files.length === 0 || dataChannelStatus !== "open";
});

sendFileBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (file) {
    try {
      const promises = [];
      for (const callId of activeConnections) {
        promises.push(sendFile(file, callId));
      }
      await Promise.all(promises);
      fileInput.value = "";
      sendFileBtn.disabled = true;
    } catch (error) {
      console.error("Failed to send file:", error);
    }
  }
});
// listen for file-received events
document.addEventListener("remote-file", (event) => {
  const { name, size, type, content } = event.detail;
  const downloadLink = document.createElement("a");
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = name;
  downloadLink.textContent = `Download ${name} (${size} bytes)`;
  const fileDiv = document.createElement("div");
  fileDiv.classList.add("peer-message");
  fileDiv.appendChild(downloadLink);
  messagesDiv.appendChild(fileDiv);
});
document.addEventListener("file-sending-progress", (event) => {
  const { transferId, fileName, fileSize, totalChunks, sentChunks } =
    event.detail;
  const progress = Math.floor((sentChunks / totalChunks) * 100);
  console.log(
    `Sending ${fileName}: ${progress}% (${sentChunks}/${totalChunks} chunks sent)`
  );
});

document.addEventListener("file-receiving-progress", (event) => {
  const { transferId, fileName, fileSize, totalChunks, receivedChunks } =
    event.detail;
  const progress = Math.floor((receivedChunks / totalChunks) * 100);
  console.log(
    `Receiving ${fileName}: ${progress}% (${receivedChunks}/${totalChunks} chunks received)`
  );
});
