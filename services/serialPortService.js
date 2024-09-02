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
import { emitErrorEvent } from "./utils.js";
// Import the error utility

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buffer = "";
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

export async function handleFirstScan(io, part) {
  firstScanData = processFirstScan(part);
  console.log("firstScanData", firstScanData);

  if (firstScanData === "NG") {
    try {
      await waitForBitToBecomeOne(1400, 1);
      const cameraData = await readRegisterAndProvideASCII(1450, 15);
      const cameraDataString = String.fromCharCode(...cameraData);

      const DEFAULT_CAMERA_DATA = await getData("defaultCameraData");

      if (cameraDataString !== DEFAULT_CAMERA_DATA) {
        io.emit("alert", { message: "Camera data incorrect" });
        emitErrorEvent(io, "CAMERA_DATA_MISMATCH", "Camera data incorrect");
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
    } catch (error) {
      emitErrorEvent(
        io,
        "FIRST_SCAN_ERROR",
        `Error during first scan: ${error.message}`
      );
      logger.error("Error during first scan:", error);
    }
  } else {
    logger.info(
      "Machine won't run further since the component is already marked."
    );
    io.emit("machine-stop", {
      message:
        "Machine won't run further since the component is already marked.",
    });
    emitErrorEvent(io, "MACHINE_STOP", "Component already marked");
    firstScanData = null;
    codeWritten = false;
  }
}

export async function handleSecondScan(io, part) {
  try {
    processSecondScan(part, firstScanData);
  } catch (error) {
    emitErrorEvent(
      io,
      "SECOND_SCAN_ERROR",
      `Error during second scan: ${error.message}`
    );
    logger.error("Error during second scan:", error);
  }
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
