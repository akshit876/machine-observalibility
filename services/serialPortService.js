import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import fs from "fs";
import path, { dirname } from "path";
import logger from "../logger.js";
import {
  updateBuffer,
  processFirstScan,
  processSecondScan,
} from "./scanUtils.js";
import {
  handlePortOpen,
  handlePortClose,
  handlePortError,
  handlePortDisconnect,
  handlePortDrain,
  handlePortFlush,
} from "./portUtils.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let buffer = ""; // Buffer to store incoming data
let firstScanData = null; // Variable to store the first scan data
let codeWritten = false; // Local management of codeWritten flag

// Initialize the serial port
export function initSerialPort() {
  const port = new SerialPort({
    path: process.env.SERIAL_PORT || "COM4",
    baudRate: parseInt(process.env.BAUD_RATE, 10) || 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    autoOpen: false,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: "\r" }));

  port.open((err) => {
    if (err) {
      handlePortError(err);
      return;
    }
    handlePortOpen();
  });

  parser.on("data", async (data) => {
    let parts = updateBuffer(data);

    while (parts.length > 1) {
      let part = parts.shift().trim();
      if (part) {
        if (!firstScanData) {
          firstScanData = processFirstScan(part);
        } else if (codeWritten) {
          await processSecondScan(part, firstScanData);
          // Reset for the next cycle
          firstScanData = null;
          codeWritten = false;
        }
      }

      let delimiter = parts.shift().trim();
      if (delimiter === "NG") {
        if (!firstScanData) {
          firstScanData = processFirstScan(delimiter);
        } else if (codeWritten) {
          await processSecondScan(delimiter, firstScanData);
          // Reset for the next cycle
          firstScanData = null;
          codeWritten = false;
        }
      }
    }

    // The last part is potentially incomplete, so keep it in the buffer
    buffer = parts.length ? parts[0] : "";
  });

  // Attach event handlers using the utility functions
  port.on("error", handlePortError);
  port.on("close", handlePortClose);
  port.on("disconnect", handlePortDisconnect);
  port.on("drain", handlePortDrain);
  port.on("flush", handlePortFlush);

  return port;
}

// Function to monitor the code file for changes
export function watchCodeFile() {
  const filePath = path.join(__dirname, "../data", "code.txt");

  fs.watchFile(filePath, (curr, prev) => {
    if (curr.size > 0 && curr.mtime !== prev.mtime) {
      logger.info("Manual code written to file");
      codeWritten = true;
    }
  });
}
