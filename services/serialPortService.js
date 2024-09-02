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
import {
  readRegister,
  readRegisterAndProvideASCII,
  writeBit,
} from "./modbus.js";
import { getData } from "./lowDbService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let buffer = "";
let firstScanData = null;
let codeWritten = false;
let specialCodeCounter = 1;

const codeFormat = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const increment = String(specialCodeCounter).padStart(4, "0");
  return `${dd}${mm}${yy}${increment}`;
};

export function initSerialPort(io, SerialPortClass = SerialPort) {
  const port = new SerialPortClass({
    path: process.env.SERIAL_PORT || "COM3",
    baudRate: parseInt(process.env.BAUD_RATE, 10) || 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    autoOpen: false,
  });

  if (SerialPortClass === MockSerialPort) {
    port.startMocking();
  }

  port.open((err) => {
    if (err) {
      handlePortError(err);
      return;
    }
    handlePortOpen();
  });

  port.on("data", async (data) => {
    const parts = updateBuffer(data);
    logger.info(`Received data: ${parts}`);
    console.log({ parts });
    while (parts.length > 1) {
      const part = parts.shift().trim();
      logger.info(`Received data part: ${part}`);

      console.log("part", part);
      if (part) {
        if (!firstScanData) {
          await handleFirstScan(io, part);
        } else if (codeWritten) {
          await handleSecondScan(io, part);
          firstScanData = null;
          codeWritten = false;
        }
      }
    }

    buffer = parts.length ? parts[0] : "";
  });

  port.on("error", handlePortError);
  port.on("close", handlePortClose);
  port.on("disconnect", handlePortDisconnect);
  port.on("drain", handlePortDrain);
  port.on("flush", handlePortFlush);

  return port;
}

async function waitForBitToBecomeOne(register, bit) {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const bitValue = await readRegister(register, 1);
      if ((bitValue & (1 << bit)) !== 0) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

async function handleFirstScan(io, part) {
  firstScanData = processFirstScan(part);
  console.log("firstScanData", firstScanData);

  if (firstScanData === "NG") {
    await waitForBitToBecomeOne(1400, 1);
    const cameraData = await readRegisterAndProvideASCII(1450, 15);
    const cameraDataString = String.fromCharCode(...cameraData);

    const DEFAULT_CAMERA_DATA = await getData("defaultCameraData");

    if (cameraDataString !== DEFAULT_CAMERA_DATA) {
      io.emit("alert", { message: "Camera data incorrect" });
    } else {
      const specialCode = codeFormat();
      specialCodeCounter++;
      const finalCode = `${specialCode}${cameraDataString}`;
      await clearCodeFile("code.txt");
      fs.writeFileSync(path.join(__dirname, "../data/code.txt"), finalCode);

      logger.info(`Final code generated and written: ${finalCode}`);

      robot.keyTap("f2");
      logger.info("F2 key press simulated");
    }
  } else {
    logger.info(
      "Machine won't run further since the component is already marked."
    );
    io.emit("machine-stop", {
      message:
        "Machine won't run further since the component is already marked.",
    });
    firstScanData = null;
    codeWritten = false;
  }
}

async function handleSecondScan(io, part) {
  processSecondScan(part, firstScanData);
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
