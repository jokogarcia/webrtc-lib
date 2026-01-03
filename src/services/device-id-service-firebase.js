import { DeviceIdServiceBase } from "./device-id-service-base";
import { getDevicesCollection } from "./init-firebase";

export class FirebaseDeviceIdService extends DeviceIdServiceBase {
  constructor() {
    
    const deviceIdIsTakenFunc = async (displayName) => {
      const querySnapshot = await getDevicesCollection()
        .where("displayName", "==", displayName)
        .get();
      return !querySnapshot.empty;
    };
    const _updateDeviceIdFunc = async (currentName, newName) => {
      const deviceDocSnapshot = await getDevicesCollection()
        .where("deviceName", "==", currentName)
        .limit(1)
        .get();
      if (deviceDocSnapshot.empty) {
        throw new Error("Device document not found in database.");
      }
      const deviceDoc = deviceDocSnapshot.docs[0];
      await deviceDoc.ref.update({ deviceName: newName });
    };
    super(deviceIdIsTakenFunc, _updateDeviceIdFunc);
  }
}
