import { getDb } from "./utils";
const ID_KEY = "device_id_v2b";
let getDeviceIdPromise = null;

export async function getDeviceId() {
  if (getDeviceIdPromise) return getDeviceIdPromise;

  getDeviceIdPromise = (async () => {
    let storedId = localStorage.getItem(ID_KEY);
    if (!storedId) {
      const newId = await generateDeviceId();
      localStorage.setItem(ID_KEY, JSON.stringify(newId));
      storedId = JSON.stringify(newId);
    }
    if (storedId && typeof storedId === "string") {
      return JSON.parse(storedId);
    }
    throw new Error("Failed to get device ID from local storage");
  })();

  return getDeviceIdPromise;
}
async function displayNameIsTaken(displayName) {
  const db = getDb();
  const querySnapshot = await db
    .collection("devices")
    .where("displayName", "==", displayName)
    .get();
  return !querySnapshot.empty;
}
async function generateDeviceId() {
  const db = getDb();
  let displayName = getRandomDigits(5);
  while (await displayNameIsTaken(displayName)) {
    displayName = getRandomDigits(5);
  }
  const deviceDoc = db.collection("devices").doc();
  const deviceDocId = deviceDoc.id;
  let id = {
    uuid: deviceDocId,
    displayName,
  };
  await deviceDoc.set(id);
  return id;
}
function getRandomDigits(length) {
  const n = Math.floor(Math.random() * Math.pow(10, length));
  return n.toString().padStart(length, "0");
}
export async function setDeviceDisplayName(newName) {
  if (!newName || typeof newName !== "string" || newName.trim() === "") {
    throw new Error("EMPTY");
  }
  if (newName.includes("-<>-")) {
    throw new Error("CONTAINS_SEPARATOR");
  }
  if (await displayNameIsTaken(newName)) {
    throw new Error("TAKEN");
  }
  const db = getDb();
  const deviceId = await getDeviceId();
  const deviceDoc = db.collection("devices").doc(deviceId.uuid);
  await deviceDoc.update({ displayName: newName });
  const updatedId = {
    ...deviceId,
    displayName: newName,
  };
  localStorage.setItem(ID_KEY, JSON.stringify(updatedId));
  return updatedId;
}
