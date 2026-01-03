import { DeviceIdServiceBase } from "./device-id-service-base";
import { getDevicesCollection } from "./init-firebase";

export class FirebaseDeviceIdService extends DeviceIdServiceBase {
  constructor() {

    const _deviceIdIsTaken = async (deviceName) => {
      const querySnapshot = await getDevicesCollection()
        .where("deviceName", "==", deviceName)
        .get();
      return !querySnapshot.empty;
    };
    const _updateDeviceId = async (currentName, newName) => {
      const deviceDocSnapshot = await getDevicesCollection()
        .where("deviceName", "==", currentName)
        .limit(1)
        .get();
      if (deviceDocSnapshot.empty) {
        throw new Error("Device document not found in database.");
      }
      const deviceDoc = deviceDocSnapshot.docs[0];
      return deviceDoc.ref.update({ deviceName: newName });
    };
    const _storeNewDeviceName = (newName) => {
      const collection = getDevicesCollection();
      const doc = collection.doc();
      return doc.set({ deviceName: newName });
    }
    super(_deviceIdIsTaken, _updateDeviceId, _storeNewDeviceName);
  }
}
