let deviceIdPromise = null;
export class DeviceIdServiceBase {
  constructor(
    deviceIdIsTakenFunc,
    updateDeviceIdFunc,
    ID_KEY = "webrtc-lib-device-id"
  ) {
    this._deviceIdIsTakenFunc = deviceIdIsTakenFunc;
    this._updateDeviceIdFunc = updateDeviceIdFunc;
    this.ID_KEY = ID_KEY;
  }
  getDeviceNamePromise() {
    if (!deviceIdPromise) {
      deviceIdPromise = new Promise(async (resolve, reject) => {
        let deviceId = localStorage.getItem(this.ID_KEY);
        if (!deviceId) {
          try {
            deviceId = await this._generateDeviceId();
            localStorage.setItem(this.ID_KEY, deviceId);
          } catch (error) {
            console.error("Error generating device ID:", error);
            reject(error);
          }
        }
        resolve(deviceId);
      });
    }
    return deviceIdPromise;
  }
  static _getRandomDigits(length) {
    const n = Math.floor(Math.random() * Math.pow(10, length));
    return n.toString().padStart(length, "0");
  }
  async _generateDeviceId(n = 5) {
    console.log("Generating device ID...");
    let deviceName = DeviceIdServiceBase._getRandomDigits(n);
    while (await this._deviceIdIsTakenFunc(deviceName)) {
      deviceName = DeviceIdServiceBase._getRandomDigits(n);
    }
    return deviceName;
  }
  getDeviceName = () => this.getDeviceNamePromise();
  async setDeviceName(newName) {
    if (!newName || typeof newName !== "string" || newName.trim() === "") {
      throw new Error("EMPTY");
    }
    if (newName.includes("-<>-")) {
      console.error("Device name may not contain the sequence '-<>-'");
      throw new Error("CONTAINS_SEPARATOR");
    }
    if (await this._deviceIdIsTakenFunc(newName)) {
      throw new Error("TAKEN");
    }
    const currentName = await this.getDeviceName();
    await this._updateDeviceIdFunc(currentName, newName);
    localStorage.setItem(ID_KEY, newName);
    return newName;
  }
}
