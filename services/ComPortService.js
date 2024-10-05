import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

class ComPortService {
  constructor(options = {}) {
    this.options = {
      path: options.path || process.env.SERIAL_PORT || "COM3",
      baudRate: parseInt(options.baudRate || process.env.BAUD_RATE, 10) || 9600,
      dataBits: options.dataBits || 8,
      stopBits: options.stopBits || 1,
      parity: options.parity || "none",
      autoOpen: false,
    };
    this.port = new SerialPort(this.options);
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\r" }));
  }

  async initSerialPort() {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          console.error("Error opening port:", err.message);
          reject(err);
        } else {
          console.log("Port opened successfully");
          resolve();
        }
      });
    });
  }

  async sendData(data) {
    return new Promise((resolve, reject) => {
      this.port.write(data, (err) => {
        if (err) {
          reject(`Error sending data: ${err.message}`);
        } else {
          resolve();
        }
      });
    });
  }

  async readData(timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout waiting for scanner data"));
      }, timeout);

      this.parser.once("data", (data) => {
        clearTimeout(timer);
        resolve(data.trim());
      });
    });
  }

  async closePort() {
    return new Promise((resolve, reject) => {
      this.port.close((err) => {
        if (err) {
          reject(`Error closing port: ${err.message}`);
        } else {
          console.log("Port closed successfully");
          resolve();
        }
      });
    });
  }
}

export default ComPortService;
