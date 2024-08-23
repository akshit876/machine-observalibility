import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import fs from "fs";
import path, { dirname } from "path";
import robot from "robotjs";
import logger from "../logger.js";
import {
  updateBuffer,
  processFirstScan,
  processSecondScan,
  clearCodeFile,
} from "./scanUtils.js";
import { MockSerialPort } from "./mockSerialPort.js";
import { fileURLToPath } from "url";
import {
  handlePortClose,
  handlePortDisconnect,
  handlePortDrain,
  handlePortError,
  handlePortFlush,
  handlePortOpen,
} from "./portUtils.js";

let buffer = "";
let firstScanData = null;
let codeWritten = false;
let specialCodeCounter = 1;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const codeFormat = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const increment = String(specialCodeCounter).padStart(4, "0");
  return `${dd}${mm}${yy}${increment}`;
};

// Modify initSerialPort to accept SerialPortClass (default to real SerialPort)
export function initSerialPort(io, SerialPortClass = SerialPort) {
  console.log("SerialPortClass", SerialPortClass);
  const port = new SerialPortClass({
    path: process.env.SERIAL_PORT || "COM4",
    baudRate: parseInt(process.env.BAUD_RATE, 10) || 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    autoOpen: false,
  });

  // Start mocking if MockSerialPort is used
  if (SerialPortClass === MockSerialPort) {
    port.startMocking();
  }
  // const parser = port.pipe(new ReadlineParser({ delimiter: "\r" }));

  port.open((err) => {
    if (err) {
      handlePortError(err);
      return;
    }
    handlePortOpen();
    // Start mocking if MockSerialPort is used
    if (SerialPortClass === MockSerialPort) {
      port.write("iuhdiuhaidhuasid\r");
      // port.startMocking();
    }
  });

  port.on("data", async (data) => {
    console.log("here");
    const parts = [...updateBuffer(data)];
    logger.info(`Received data: ${parts}`);
    console.log({ parts });
    while (parts.length > 1) {
      const part = parts.shift().trim();
      console.log("part", part);
      if (part) {
        if (!firstScanData) {
          firstScanData = processFirstScan(part);
          console.log("firstScanData", firstScanData);

          if (firstScanData === "NG") {
            const specialCode = codeFormat();
            specialCodeCounter++;
            await clearCodeFile("code.txt");
            fs.writeFileSync(
              path.join(__dirname, "../data/code.txt"),
              specialCode,
            );

            logger.info(`Special code generated and written: ${specialCode}`);

            robot.keyTap("f2");
            logger.info("F2 key press simulated");
          } else {
            logger.info(
              "Machine won't run further since the component is already marked.",
            );
            io.emit("machine-stop", {
              message:
                "Machine won't run further since the component is already marked.",
            });
            return;
          }
        } else if (codeWritten) {
          await processSecondScan(part, firstScanData);
          // Reset for the next cycle
          firstScanData = null;
          codeWritten = false;
        }
      }

      const delimiter = parts.shift().trim();
      if (delimiter === "NG") {
        if (!firstScanData) {
          firstScanData = processFirstScan(delimiter);

          const specialCode = codeFormat();
          specialCodeCounter++;
          await clearCodeFile("code.txt");
          fs.writeFileSync(
            path.join(__dirname, "../data/code.txt"),
            specialCode,
          );

          logger.info(`Special code generated and written: ${specialCode}`);

          robot.keyTap("f2");
          logger.info("F2 key press simulated");
        } else if (codeWritten) {
          await processSecondScan(delimiter, firstScanData);
          firstScanData = null;
          codeWritten = false;
        }
      }
    }

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

export function watchCodeFile() {
  const filePath = path.join(__dirname, "../data/code.txt");

  fs.watch(filePath, (eventType) => {
    if (eventType === "change") {
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        logger.info("Manual code written to file");
        codeWritten = true;
      }
    }
  });
}
