import { getDevicesCollection } from "./init-firebase";
//Device ID management code
const ID_KEY = "webrtc-lib-device-id";
let getDeviceIdPromise = null;
/**
 * 
 * @returns {Promise<string>} The device's unique ID
 */
export async function getDeviceName() {
  if (getDeviceIdPromise) return getDeviceIdPromise;

  getDeviceIdPromise = (async () => {
    let storedId = localStorage.getItem(ID_KEY);
    if (!storedId) {
      const newId = await generateDeviceId();
      localStorage.setItem(ID_KEY, newId);
      storedId = newId;
    }
    if (storedId && typeof storedId === "string") {
      return storedId;
    }
    throw new Error("Failed to get device ID from local storage");
  })();

  return getDeviceIdPromise;
}
/**
 * Checks if a display name is already taken.
 * NOTE: this is the only function that requires Firebase.
 * To implement this functionality without Firebase,
 * only this function needs to be replaced.
 * @param {string} displayName 
 * @returns {Promise<boolean>} True if the display name is taken, false otherwise.
 */
async function displayNameIsTaken(displayName) {
    const collection = getDevicesCollection();
    const querySnapshot = await collection
    .where("displayName", "==", displayName)
    .get();
  return !querySnapshot.empty;
}
async function generateDeviceId() {
  const db = getDb();
  let deviceName = getRandomDigits(5);
  while (await displayNameIsTaken(deviceName)) {
    deviceName = getRandomDigits(5);
  }
  const deviceDoc = db.collection("devices").doc();
  await deviceDoc.set(deviceName);
  return deviceName;
}
function getRandomDigits(length) {
  const n = Math.floor(Math.random() * Math.pow(10, length));
  return n.toString().padStart(length, "0");
}
export async function setDeviceName(newName) {
  if (!newName || typeof newName !== "string" || newName.trim() === "") {
    throw new Error("EMPTY");
  }
  if (newName.includes("-<>-")) {
    console.error("Device name may not contain the sequence '-<>-'");
    throw new Error("CONTAINS_SEPARATOR");
  }
  if (await displayNameIsTaken(newName)) {
    throw new Error("TAKEN");
  }
  const currentName = await getDeviceName();
  const deviceDocSnapshot = await getDevicesCollection().where("deviceName", "==", currentName).limit(1).get();
    if (deviceDocSnapshot.empty) {
    throw new Error("Device document not found in database.");
  }
  const deviceDoc = deviceDocSnapshot.docs[0];
  await deviceDoc.ref.update({ deviceName: newName });
  
  localStorage.setItem(ID_KEY, newName);
  return newName;
}

export class DeviceIdService{
    constructor(){
        this.deviceIdIsTakenFunc = deviceIdIsTakenFunc;
    }
    static getRandomDigits(length) {
        const n = Math.floor(Math.random() * Math.pow(10, length));
        return n.toString().padStart(length, "0");
    }
    async generateDeviceId(n=5) {
        let deviceName = DeviceIdService.getRandomDigits(n);
        while (await this.deviceIdIsTakenFunc(deviceName)) {
            deviceName = DeviceIdService.getRandomDigits(n);
        }
        return deviceName;
    }
}