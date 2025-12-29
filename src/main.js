import './style.css'
import { getDeviceId } from './my-webrtc-functions.js'
import { initiateConnection, sendMessage } from './my-webrtc-functions.js'

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
</style>
  <div>
    <h1>My ID: <span id="my-id"></span></h1>
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
const myIdSpan = document.getElementById('my-id')
const peerIdSpan = document.getElementById('peer-id')
const remoteIdInput = document.getElementById('remote-id')
const connectBtn = document.getElementById('connect-btn')
const statusDiv = document.getElementById('status')
const messagesDiv = document.getElementById('messages')
const messageInput = document.getElementById('message-input')
const sendBtn = document.getElementById('send-btn')
let dataChannelStatus = 'closed';
document.addEventListener('data-channel-state', (event) => {
  dataChannelStatus = event.detail;
  statusDiv.textContent = `Data Channel is ${dataChannelStatus}`;
  sendBtn.disabled = messageInput.value.trim() === '' || dataChannelStatus !== 'open';
});
myIdSpan.textContent = getDeviceId()
remoteIdInput.addEventListener('input', () => {
  connectBtn.disabled = remoteIdInput.value.trim() === ''
})

connectBtn.addEventListener('click', async () => {
  const remoteId = remoteIdInput.value.trim()
  const myId = getDeviceId()
  peerIdSpan.textContent = remoteId
  statusDiv.textContent = 'Connecting...'
  await initiateConnection(myId, remoteId)
  statusDiv.textContent = 'Connected'
 
})
document.addEventListener('remote-message', (event) => {
  const msgDiv = document.createElement('div')
  msgDiv.classList.add('peer-message')
  msgDiv.textContent = event.data
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



