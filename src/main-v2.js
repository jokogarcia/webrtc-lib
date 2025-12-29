import './style.css'
import { getDeviceId, setDeviceDisplayName } from './device-id.js'
import { initiateConnection, sendMessage } from './my-webrtc-functions-v2.js'

document.querySelector('#app').innerHTML = `
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
  </div>
`
const displayNameInput = document.getElementById('display-name-input')
const displayNameInputError = document.getElementById('display-name-input-error')
const setNameBtn = document.getElementById('set-name-btn')
const peerIdSpan = document.getElementById('peer-id')
const remoteIdInput = document.getElementById('remote-id')
const connectBtn = document.getElementById('connect-btn')
const statusDiv = document.getElementById('status')
const messagesDiv = document.getElementById('messages')
const messageInput = document.getElementById('message-input')
const sendBtn = document.getElementById('send-btn')
let dataChannelStatus = 'closed';
let currentDisplayName = '';
getDeviceId().then((id) => {
  displayNameInput.value = id.displayName;
  currentDisplayName = id.displayName;
});
displayNameInput.addEventListener('input', () => {
  setNameBtn.disabled = displayNameInput.value.trim() === '' || displayNameInput.value.trim() === currentDisplayName;
})
setNameBtn.addEventListener('click', async () => {
  const newName = displayNameInput.value.trim();
  if(newName && newName !== currentDisplayName) {
    try {
      const updatedId = await setDeviceDisplayName(newName);
      currentDisplayName = updatedId.displayName;
      setNameBtn.disabled = true;
      displayNameInputError.classList.add('hidden');
    } catch (error) {
      if(error.message === "TAKEN") {
        displayNameInputError.classList.remove('hidden');
        displayNameInputError.textContent = 'Display name is already taken. Please choose another one.';
      } else if(error.message === "EMPTY") {
        displayNameInputError.classList.remove('hidden');
        displayNameInputError.textContent = 'Display name cannot be empty.';

      }
      else if(error.message === "CONTAINS_SEPARATOR") {
        displayNameInputError.classList.remove('hidden');
        displayNameInputError.textContent = 'Display name cannot contain the sequence "-<>-". Please choose another one.';
      }
      else{
        console.error('Failed to set display name:', error);
        displayNameInputError.classList.remove('hidden');
        displayNameInputError.textContent = 'Failed to set display name. Please try again.';
      }
    }
  }
})
displayNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !setNameBtn.disabled) {
    setNameBtn.click()
  }
});
document.addEventListener('data-channel-state', (event) => {
  console.log('Data channel state changed:', event.detail);
  dataChannelStatus = event.detail;
  statusDiv.textContent = `Data Channel is ${dataChannelStatus}`;
  sendBtn.disabled = messageInput.value.trim() === '' || dataChannelStatus !== 'open';
});
remoteIdInput.addEventListener('input', () => {
  connectBtn.disabled = remoteIdInput.value.trim() === ''
})
remoteIdInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !connectBtn.disabled) {
    connectBtn.click()
  }
});
connectBtn.addEventListener('click', async () => {
  const remoteName = remoteIdInput.value.trim()
  const myId = await getDeviceId()
  peerIdSpan.textContent = remoteName
  statusDiv.textContent = 'Connecting...'
  await initiateConnection(myId.displayName, remoteName)
 
})
document.addEventListener('remote-message', (event) => {
  const msgDiv = document.createElement('div')
  msgDiv.classList.add('peer-message')
  
  const names= event.detail.channelName.split('-<>-');
  const senderName = names.filter(n => n !== currentDisplayName)[0] || 'Unknown';
  msgDiv.innerHTML = `<span class="sender-name">${senderName}:</span> ${event.detail.data}`;
  messagesDiv.appendChild(msgDiv)
});
messageInput.addEventListener('input', () => {
  sendBtn.disabled = messageInput.value.trim() === '' || dataChannelStatus !== 'open';
})
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendBtn.click()
  }
});
sendBtn.addEventListener('click', () => {
  const message = messageInput.value.trim()
  try{
    sendMessage(message)
    const msgDiv = document.createElement('div')
    msgDiv.classList.add('my-message')
    msgDiv.textContent = message
    messagesDiv.appendChild(msgDiv)
    messageInput.value = ''
    sendBtn.disabled = true
  } catch (error) {
    console.error('Failed to send message:', error);
  }
})



