import { SerialPort } from "serialport";
import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
class BufferedComPortService {
  constructor(options = {}) {
    this.options = {
      path: options.path || process.env.SERIAL_PORT || "COM4",
      baudRate: parseInt(options.baudRate || process.env.BAUD_RATE, 10) || 9600,
      logDir: options.logDir || "logs",
    };
    this.port = null;
    this.buffer = "";
    this.dataCallback = null;
    this.isInitialized = false;
    this.setupLogger();
  }

  setupLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    );

    this.logger = winston.createLogger({
      level: "info",
      format: logFormat,
      transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
          filename: path.join(this.options.logDir, "application-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          zippedArchive: true,
          maxSize: "20m",
          maxFiles: "14d",
        }),
      ],
    });
  }

  log(message, level = "info") {
    this.logger.log(level, message);
  }

  async initSerialPort() {
    if (this.isInitialized) {
      this.log("Serial port is already initialized");
      return;
    }

    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: this.options.path,
        baudRate: this.options.baudRate,
        autoOpen: false,
      });

      this.port.open((err) => {
        if (err) {
          this.log(`Error opening port: ${err.message}`, "error");
          console.error("Error opening port:", err.message);
          reject(err);
        } else {
          this.log("Port opened successfully");
          console.log("Port opened successfully");
          this.setupListeners();
          this.isInitialized = true;
          resolve();
        }
      });
    });
  }

  setupListeners() {
    this.port.on("data", (data) => {
      this.buffer += data.toString("utf8");
      this.log(`Received raw data: ${data.toString("utf8")}`, "debug");
      this.processBuffer();
    });

    this.port.on("error", (err) => {
      this.log(`Port error: ${err.message}`, "error");
      console.error("Port error:", err);
    });
  }

  processBuffer() {
    let lineEnd = this.buffer.indexOf("\n");
    while (lineEnd > -1) {
      const line = this.buffer.slice(0, lineEnd).trim();
      if (line) {
        this.processLine(line);
      }
      this.buffer = this.buffer.slice(lineEnd + 1);
      lineEnd = this.buffer.indexOf("\n");
    }
  }

  processLine(line) {
    this.log(`Processed line: ${line}`, "info");
    if (this.dataCallback) {
      this.dataCallback(line);
    }
  }

  readData(callback) {
    this.dataCallback = callback;
  }

  async sendData(data) {
    if (!this.isInitialized) {
      throw new Error("Serial port is not initialized");
    }

    return new Promise((resolve, reject) => {
      this.port.write(data, (err) => {
        if (err) {
          this.log(`Error sending data: ${err.message}`, "error");
          reject(`Error sending data: ${err.message}`);
        } else {
          this.log(`Data sent: ${data}`, "info");
          resolve();
        }
      });
    });
  }

  readDataSync(timeout = 30000) {
    return new Promise((resolve, reject) => {
      let data = "";
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout waiting for data"));
      }, timeout);

      const dataHandler = (chunk) => {
        data += chunk.toString();
        if (data.includes("\n")) {
          clearTimeout(timeoutId);
          this.port.removeListener("data", dataHandler);
          resolve(data.trim());
        }
      };

      this.port.on("data", dataHandler);
    });
  }

  async closePort() {
    if (!this.isInitialized) {
      this.log("Port is not initialized, nothing to close");
      return;
    }

    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      this.port.close((err) => {
        if (err) {
          this.log(`Error closing port: ${err.message}`, "error");
          reject(`Error closing port: ${err.message}`);
        } else {
          this.log("Port closed successfully");
          console.log("Port closed successfully");
          this.isInitialized = false;
          resolve();
        }
      });
    });
  }
}

export default BufferedComPortService;
// // Usage example:
// const comService = new BufferedComPortService({
//   path: "COM3", // Make sure this matches your actual COM port
//   baudRate: 9600, // Adjust if needed
//   logDir: "com_port_logs", // Specify the directory for log files
// });

// comService
//   .initSerialPort()
//   .then(() => {
//     console.log("Port initialized, waiting for data...");
//     comService.readData((line) => {
//       console.log("Received data:", line);
//     });
//     // Optionally, send some data
//     // return comService.sendData('Hello, COM port!\r\n');
//   })
//   .catch((error) => {
//     console.error("Error:", error);
//   });
