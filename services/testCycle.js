import { fileURLToPath } from "url";
import logger from "../logger.js";
import { connect, readBit, writeBitsWithRest } from "./modbus.js";
// import { waitForBitToBecomeOne } from "./serialPortService.js";

import { format } from "date-fns";
import fs from "fs";
import path, { dirname } from "path";
import ComPortService from "./ComPortService.js";
import ShiftUtility from "./ShiftUtility.js";
import BarcodeGenerator from "./barcodeGenrator.js";
import mongoDbService from "./mongoDbService.js";
import BufferedComPortService from "./ComPortService.js";
import EventEmitter from "events";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const comPort = new ComPortService();

async function saveToMongoDB({
  io,
  serialNumber,
  markingData,
  scannerData,
  result,
}) {
  const now = new Date();
  const timestamp = format(now, "yyyy-MM-dd HH:mm:ss");

  const data = {
    Timestamp: new Date(timestamp),
    SerialNumber: serialNumber,
    MarkingData: markingData,
    ScannerData: scannerData,
    Result: result ? "OK" : "NG",
  };

  try {
    // Save to MongoDB
    await mongoDbService.insertRecord(data);
    logger.info(`Data saved to MongoDB`);

    if (io) {
      mongoDbService.sendMongoDbDataToClient(io, "main-data", "records");
    }
  } catch (error) {
    console.error({ error });
    logger.error("Error saving data:", error);
    throw error;
  }
}

const CODE_FILE_PATH = path.join(__dirname, "../data/code.txt");

async function writeOCRDataToFile(ocrDataString) {
  try {
    await clearCodeFile(CODE_FILE_PATH); // Clear the file before writing new data
    fs.writeFileSync(CODE_FILE_PATH, ocrDataString, "utf8");
    logger.info("OCR data written to code.txt");
  } catch (error) {
    logger.error(`Error writing OCR data to file: ${error.message}`);
    throw error;
  }
}

/**
 * Clears the contents of 'code.txt'.
 */
async function clearCodeFile(path) {
  try {
    fs.writeFileSync(path, "", "utf8"); // Overwrite with an empty string
    logger.info("Code file cleared.");
  } catch (error) {
    logger.error(`Error clearing code file: ${error.message}`);
    throw error;
  }
}

/**
 * Compares the scanner data with the contents of 'code.txt'.
 * @param {string} scannerData - The scanner data to compare.
 * @returns {boolean} - True if the data matches, otherwise false.
 */
async function compareScannerDataWithCode(scannerData) {
  try {
    const codeData = fs.readFileSync(CODE_FILE_PATH, "utf8").trim();
    const isMatch = scannerData === codeData;
    logger.info(`Comparison result: ${isMatch ? "Match" : "No match"}`);
    return isMatch;
  } catch (error) {
    logger.error(
      `Error comparing scanner data with code file: ${error.message}`
    );
    throw error;
  }
}

let c = 0;
const shiftUtility = new ShiftUtility();
const barcodeGenerator = new BarcodeGenerator(shiftUtility);
barcodeGenerator.initialize("main-data", "records");
barcodeGenerator.setResetTime(6, 0);
const comService = new BufferedComPortService({
  path: "COM3", // Make sure this matches your actual COM port
  baudRate: 9600, // Adjust if needed
  logDir: "com_port_logs", // Specify the directory for log files
});

// // Generate barcode data for current date and time
// console.log(barcodeGenerator.generateBarcodeData());
// export async function runContinuousScan(io = null, comService) {
//   let shouldRestart = false;

//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0);
//       await writeBitsWithRest(1414, 3, 0);
//       await writeBitsWithRest(1414, 4, 0);
//       await writeBitsWithRest(1414, 6, 0);
//       await writeBitsWithRest(1414, 7, 0);
//       await writeBitsWithRest(1414, 12, 0);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   const monitorRestartSignal = async () => {
//     while (true) {
//       const signal = await readBit(1410, 1);
//       if (signal) {
//         shouldRestart = true;
//         await resetBits(); // Reset all bits if signal detected
//         logger.info("Restart signal detected. Workflow will restart.");
//         break; // Exit monitoring when restart signal is detected
//       }
//       await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
//     }
//   };

//   while (true) {
//     shouldRestart = false;
//     monitorRestartSignal(); // Start monitoring restart signal asynchronously

//     try {
//       console.log("Counter", c + 1);
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       await waitForBitToBecomeOne(1410, 0, 1);
//       if (shouldRestart) continue;

//       const scannerData = await comService.readDataSync(200 * 1000);
//       if (shouldRestart) continue;

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1);
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await writeBitsWithRest(1414, 7, 1);
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         await writeOCRDataToFile(text);
//         await writeBitsWithRest(1410, 11, 1);
//         if (shouldRestart) continue;

//         await writeBitsWithRest(1415, 4, 1);
//         await waitForBitToBecomeOne(1410, 2, 1);
//         if (shouldRestart) continue;

//         await writeBitsWithRest(1414, 1, 1);
//         const secondScannerData = await comService.readDataSync(200 * 1000);
//         if (shouldRestart) continue;

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1);
//         } else {
//           await writeBitsWithRest(1414, 7, 1);
//         }

//         const isDataMatching =
//           await compareScannerDataWithCode(secondScannerData);
//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1);
//         } else {
//           await writeBitsWithRest(1414, 4, 1);
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });

//         await waitForBitToBecomeOne(1410, 12, 1);
//         if (shouldRestart) continue;

//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       await writeBitsWithRest(1414, 12, 1); // Signal error to PLC
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   let shouldRestart = false;

//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0);
//       await writeBitsWithRest(1414, 3, 0);
//       await writeBitsWithRest(1414, 4, 0);
//       await writeBitsWithRest(1414, 6, 0);
//       await writeBitsWithRest(1414, 7, 0);
//       await writeBitsWithRest(1414, 12, 0);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   const monitorRestartSignal = async () => {
//     while (true) {
//       const signal = await readBit(1410, 1);
//       if (signal) {
//         shouldRestart = true;
//         await resetBits();
//         logger.info("Restart signal detected. Workflow will restart.");
//         return; // Return immediately to stop the current operation
//       }
//       await new Promise((resolve) => setTimeout(resolve, 50)); // Check every 100ms
//     }
//   };

//   const awaitWithRestartCheck = async (awaitedFunction) => {
//     return Promise.race([awaitedFunction, monitorRestartSignal()]);
//   };

//   while (true) {
//     shouldRestart = false;

//     try {
//       console.log("Counter", c + 1);
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       await awaitWithRestartCheck(waitForBitToBecomeOne(1410, 0, 1));
//       if (shouldRestart) continue;

//       const scannerData = await awaitWithRestartCheck(
//         comService.readDataSync(200 * 1000)
//       );
//       if (shouldRestart) continue;

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1);
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await writeBitsWithRest(1414, 7, 1);
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         await writeOCRDataToFile(text);
//         await writeBitsWithRest(1410, 11, 1);
//         if (shouldRestart) continue;

//         await awaitWithRestartCheck(waitForBitToBecomeOne(1410, 2, 1));
//         if (shouldRestart) continue;

//         await writeBitsWithRest(1414, 1, 1);
//         const secondScannerData = await awaitWithRestartCheck(
//           comService.readDataSync(200 * 1000)
//         );
//         if (shouldRestart) continue;

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1);
//         } else {
//           await writeBitsWithRest(1414, 7, 1);
//         }

//         const isDataMatching = await awaitWithRestartCheck(
//           compareScannerDataWithCode(secondScannerData)
//         );
//         if (shouldRestart) continue;

//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1);
//         } else {
//           await writeBitsWithRest(1414, 4, 1);
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });

//         await awaitWithRestartCheck(waitForBitToBecomeOne(1410, 12, 1));
//         if (shouldRestart) continue;

//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       await writeBitsWithRest(1414, 12, 1); // Signal error to PLC
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   let shouldRestart = false;

//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0);
//       await writeBitsWithRest(1414, 3, 0);
//       await writeBitsWithRest(1414, 4, 0);
//       await writeBitsWithRest(1414, 6, 0);
//       await writeBitsWithRest(1414, 7, 0);
//       await writeBitsWithRest(1414, 12, 0);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   // Continuous monitoring function for reset signal
//   const startResetMonitor = () => {
//     setInterval(async () => {
//       const signal = await readBit(1410, 1);
//       if (signal && !shouldRestart) {
//         shouldRestart = true; // Set flag to true if reset is detected
//         await resetBits();
//         logger.info("Restart signal detected. Resetting workflow.");
//       }
//     }, 100); // Check every 100ms
//   };

//   // Start monitoring the reset signal in parallel
//   startResetMonitor();

//   while (true) {
//     if (shouldRestart) {
//       shouldRestart = false; // Reset the flag before restarting
//       continue; // Restart the loop from the beginning
//     }

//     try {
//       console.log("Counter", c + 1);
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       await waitForBitToBecomeOne(1410, 0, 1);
//       if (shouldRestart) continue;

//       const scannerData = await comService.readDataSync(200 * 1000);
//       if (shouldRestart) continue;

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1);
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await writeBitsWithRest(1414, 7, 1);
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         await writeOCRDataToFile(text);
//         await writeBitsWithRest(1410, 11, 1);
//         if (shouldRestart) continue;

//         await waitForBitToBecomeOne(1410, 2, 1);
//         if (shouldRestart) continue;

//         await writeBitsWithRest(1414, 1, 1);
//         const secondScannerData = await comService.readDataSync(200 * 1000);
//         if (shouldRestart) continue;

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1);
//         } else {
//           await writeBitsWithRest(1414, 7, 1);
//         }

//         const isDataMatching =
//           await compareScannerDataWithCode(secondScannerData);
//         if (shouldRestart) continue;

//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1);
//         } else {
//           await writeBitsWithRest(1414, 4, 1);
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });

//         await waitForBitToBecomeOne(1410, 12, 1);
//         if (shouldRestart) continue;

//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       console.log({ error });
//       // await writeBitsWithRest(1414, 12, 1); // Signal error to PLC
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   let shouldRestart = false;

//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0);
//       await writeBitsWithRest(1414, 3, 0);
//       await writeBitsWithRest(1414, 4, 0);
//       await writeBitsWithRest(1414, 6, 0);
//       await writeBitsWithRest(1414, 7, 0);
//       await writeBitsWithRest(1414, 12, 0);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   const monitorResetSignal = async () => {
//     const signal = await readBit(1410, 1); // Check if reset signal is triggered
//     if (signal) {
//       shouldRestart = true;
//       await resetBits();
//       logger.info("Reset signal detected. Restarting workflow.");
//     }
//   };

//   const waitForBitOrRestart = async (bitAddress, bitIndex, timeout) => {
//     const end = Date.now() + timeout;
//     while (Date.now() < end) {
//       if (shouldRestart) {
//         return false; // Exit early if reset signal is triggered
//       }
//       const bitStatus = await readBit(bitAddress, bitIndex);
//       if (bitStatus) {
//         return true; // Bit detected as 1, continue with workflow
//       }
//       await new Promise((resolve) => setTimeout(resolve, 100)); // Poll every 100ms
//     }
//     throw new Error(
//       `Timeout reached while waiting for bit ${bitAddress}.${bitIndex}`
//     );
//   };

//   setInterval(monitorResetSignal, 100); // Continuously monitor reset signal every 100ms

//   while (true) {
//     if (shouldRestart) {
//       shouldRestart = false;
//       continue;
//     }

//     try {
//       console.log("Counter", c + 1);
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       const bit0Detected = await waitForBitOrRestart(1410, 0, 30000);
//       if (!bit0Detected || shouldRestart) continue;

//       const scannerData = await comService.readDataSync(200 * 1000);
//       if (shouldRestart) continue;

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1);
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await writeBitsWithRest(1414, 7, 1);
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         await writeOCRDataToFile(text);
//         await writeBitsWithRest(1410, 11, 1);
//         if (shouldRestart) continue;

//         const bit2Detected = await waitForBitOrRestart(1410, 2, 30000);
//         if (!bit2Detected || shouldRestart) continue;

//         await writeBitsWithRest(1414, 1, 1);
//         const secondScannerData = await comService.readDataSync(200 * 1000);
//         if (shouldRestart) continue;

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1);
//         } else {
//           await writeBitsWithRest(1414, 7, 1);
//         }

//         const isDataMatching =
//           await compareScannerDataWithCode(secondScannerData);
//         if (shouldRestart) continue;

//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1);
//         } else {
//           await writeBitsWithRest(1414, 4, 1);
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });

//         const bit12Detected = await waitForBitOrRestart(1410, 12, 30000);
//         if (!bit12Detected || shouldRestart) continue;

//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       // await writeBitsWithRest(1414, 12, 1);
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   let shouldRestart = false; // Flag to indicate if a reset is needed

//   // Function to reset all relevant bits to zero
//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0); // Reset scanner trigger bit
//       await writeBitsWithRest(1414, 3, 0); // Reset OK signal bit
//       await writeBitsWithRest(1414, 4, 0); // Reset NG signal bit
//       await writeBitsWithRest(1414, 6, 0); // Reset data found signal bit
//       await writeBitsWithRest(1414, 7, 0); // Reset data not found signal bit
//       await writeBitsWithRest(1414, 12, 0); // Reset error signal bit
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   let hasLoggedMonitorStart = false; // Flag to ensure we log only once

//   const monitorResetSignal = async () => {
//     if (!hasLoggedMonitorStart) {
//       logger.info("Monitoring reset bit at 1600.0..."); // Log once at the start
//       hasLoggedMonitorStart = true; // Set flag to true after logging
//     }

//     const signal = await readBit(1600, 0, true); // Check if reset signal is triggered
//     if (signal) {
//       shouldRestart = true; // Trigger reset if signal is detected
//       await resetBits(); // Reset all bits to prepare for workflow restart
//       logger.info("Reset signal detected. Restarting workflow.");
//     }
//   };

//   // Function to wait for a specific bit to become 1 or exit early if reset signal is detected
//   const waitForBitOrRestart = async (bitAddress, bitIndex, timeout) => {
//     logger.info(`Waiting for bit ${bitAddress}.${bitIndex} to become 1...`); // Log once at the start
//     const end = Date.now() + timeout; // Calculate the timeout end time

//     while (Date.now() < end) {
//       if (shouldRestart) {
//         return false; // Exit early if reset signal is detected
//       }
//       const bitStatus = await readBit(bitAddress, bitIndex); // Read the status of the specified bit
//       if (bitStatus) {
//         return true; // If the bit is set, proceed with the workflow
//       }
//       await new Promise((resolve) => setTimeout(resolve, 100)); // Poll every 100ms to check bit status
//     }
//     throw new Error(
//       `Timeout reached while waiting for bit ${bitAddress}.${bitIndex}`
//     ); // Throw error if bit is not set within the timeout
//   };

//   // Continuously check for reset signal in the background
//   setInterval(monitorResetSignal, 100); // Check reset signal every 100ms

//   // Main workflow loop
//   while (true) {
//     if (shouldRestart) {
//       // If reset flag is set, restart the loop
//       shouldRestart = false; // Reset the flag for the next cycle
//       continue;
//     }

//     try {
//       console.log("Counter", c + 1);
//       await mongoDbService.connect("main-data", "records"); // Connect to the MongoDB database
//       await comService.initSerialPort(); // Initialize the serial port
//       logger.info("Starting scanner workflow");

//       // Wait for bit 1410.0 to signal the start, or restart if reset signal is detected
//       const bit0Detected = await waitForBitOrRestart(1410, 0, 30000);
//       if (!bit0Detected || shouldRestart) continue; // Restart if bit not detected or reset signal detected

//       // Read scanner data with a 200-second timeout
//       const scannerData = await comService.readDataSync(200 * 1000);
//       if (shouldRestart) continue; // Restart if reset signal detected

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1); // Signal to PLC that data was found
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await writeBitsWithRest(1414, 7, 1); // Signal to PLC that data was not found
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData(); // Generate barcode data
//         await writeOCRDataToFile(text); // Save OCR data to file
//         await writeBitsWithRest(1410, 11, 1); // Confirm file transfer to PLC
//         if (shouldRestart) continue;

//         // Wait for bit 1410.2, indicating readiness for the next step
//         const bit2Detected = await waitForBitOrRestart(1410, 2, 30000);
//         if (!bit2Detected || shouldRestart) continue;

//         await writeBitsWithRest(1414, 1, 1); // Trigger scanner bit
//         const secondScannerData = await comService.readDataSync(200 * 1000); // Read second scanner data
//         if (shouldRestart) continue;

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1); // Signal OK to PLC if data is found
//         } else {
//           await writeBitsWithRest(1414, 7, 1); // Signal NG to PLC if data is not found
//         }

//         // Compare the scanner data with expected code
//         const isDataMatching =
//           await compareScannerDataWithCode(secondScannerData);
//         if (shouldRestart) continue;

//         // Send final OK/NG signal based on data matching result
//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1); // Send OK signal
//         } else {
//           await writeBitsWithRest(1414, 4, 1); // Send NG signal
//         }

//         // Save the result to MongoDB
//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });

//         // Wait for bit 1410.12 to indicate readiness for the next cycle
//         const bit12Detected = await waitForBitOrRestart(1410, 12, 30000);
//         if (!bit12Detected || shouldRestart) continue;

//         c++;
//         await resetBits(); // Reset all bits after successful cycle
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error); // Log errors
//       console.log({ error });
//       // await writeBitsWithRest(1414, 12, 1); // Signal error to PLC
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   // eslint-disable-next-line no-constant-condition

//   const resetBits = async () => {
//     try {
//       // await writeBitsWithRest(1414, 0, 0); // Reset bit 1414.0
//       await writeBitsWithRest(1414, 1, 0); // Reset bit 1414.1
//       await writeBitsWithRest(1414, 3, 0); // Reset bit 1414.3
//       await writeBitsWithRest(1414, 4, 0); // Reset bit 1414.4
//       await writeBitsWithRest(1414, 6, 0); // Reset bit 1414.6
//       await writeBitsWithRest(1414, 7, 0); // Reset bit 1414.7
//       await writeBitsWithRest(1414, 12, 0); // Reset bit 1414.12
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   while (true) {
//     try {
//       console.log("Counter", c + 1);
//       // if (c == 1) {
//       //   logger.info(" CYCLE ONE OVER");
//       //   return;
//       // }
//       await mongoDbService.connect("main-data", "records");
//       // await comPort.initSerialPort();
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       // 1. Start
//       // await writeBitsWithRest(1410, 0, 1, 30000);
//       await waitForBitToBecomeOne(1410, 0, 1);
//       logger.info("Received signal from PLC at 1410.0");

//       // 2-3. Read scanner data from s/w
//       // let scannerData = "";
//       // await comService.readData((line) => {
//       //   // console.log("Received data:", line);
//       //   scannerData = line;
//       // });
//       const scannerData = await comService.readDataSync();
//       // logger.info(`Second scanner data: ${secondScannerData}`);
//       logger.info(`Scanner data: ${scannerData}`);

//       // 4-5. Check if data is OK or NG
//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1); // Signal  to PLC
//         logger.info("Scanner data is found, stopping machine");
//         continue; // Exit the function if NG
//       } else {
//         console.log("her1");
//         await writeBitsWithRest(1414, 7, 1); // Signal  to PLC
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         console.log("her1");

//         await writeOCRDataToFile(text);
//         logger.info("Scanner data is NG, transferred to text file");
//         await writeBitsWithRest(1410, 11, 1); // Signal  to PLC

//         // 6.MARKING START BIT FROM S/W TO PLC
//         await writeBitsWithRest(1415, 4, 1);
//         logger.info("File transfer confirmation sent to PLC");

//         // // 7. Get signal from PLC at 1414.2
//         await waitForBitToBecomeOne(1410, 2, 1);
//         logger.info("Received signal from PLC at 1410.2");

//         // 8. Trigger scanner on bit now to PLC
//         await writeBitsWithRest(1414, 1, 1);
//         logger.info("Triggered scanner bit to PLC");

//         // 9. Read scanner data now
//         // const secondScannerData = await comPort.readData();
//         // logger.info(`Second scanner data: ${secondScannerData}`);
//         // let secondScannerData = "";
//         // await comService.readData((line) => {
//         //   // console.log("Received data:", line);
//         //   secondScannerData = line;
//         // });
//         const secondScannerData = await comService.readDataSync();
//         // logger.info(`Second scanner data: ${secondScannerData}`);
//         logger.info(`Second Scanner data: ${secondScannerData}`);

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1); // Signal  to PLC
//           logger.info("Scanner ok to PLC");
//         } else {
//           await writeBitsWithRest(1414, 7, 1); // Signal  to PLC
//           logger.info("Scanner Nok to PLC");
//         }

//         // 10. Compare scanner results
//         const isDataMatching =
//           await compareScannerDataWithCode(secondScannerData);

//         // 11. Final give ok nok to PLC
//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1); // OK signal
//           logger.info("Scanner data matches, sent OK signal to PLC");
//         } else {
//           await writeBitsWithRest(1414, 4, 1); // NG signal
//           logger.info("Scanner data does not match, sent NG signal to PLC");
//         }
//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });
//         logger.info("Scanner workflow completed");

//         // Optional: Add a small delay between cycles if needed
//         // await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
//         // / 7. Get signal from PLC at 1410.12
//         await waitForBitToBecomeOne(1410, 12, 1);
//         // reset al registgers over here if we get 1414.6 oir 1414.7 as 1

//         // await new Promise((resolve) => setTimeout(resolve, 10 * 1000));

//         await writeBitsWithRest(1414, 0, 1);

//         // logger.info("Received signal from PLC at 1410.2");
//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       // Implement error handling, possibly signaling an error to the PLC
//       await writeBitsWithRest(1414, 12, 1); // NG signal in case of error
//     } finally {
//       await comPort.closePort();
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   const resetEvent = new EventEmitter();
//   let resetLogged = false;

//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0, false);
//       await writeBitsWithRest(1414, 3, 0, false);
//       await writeBitsWithRest(1414, 4, 0, false);
//       await writeBitsWithRest(1414, 6, 0, false);
//       await writeBitsWithRest(1414, 7, 0, false);
//       await writeBitsWithRest(1414, 12, 0, false);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   const trackRegister100 = async () => {
//     while (true) {
//       try {
//         const value = await readBit(1600, 0);
//         if (value === 1) {
//           if (!resetLogged) {
//             logger.info(
//               "Register 1600.0 became 1, triggering reset and restart"
//             );
//             resetLogged = true;
//           }
//           resetEvent.emit("reset");
//           return;
//         }
//         await new Promise((resolve) => setTimeout(resolve, 10)); // Check every 100ms
//       } catch (error) {
//         logger.error("Error tracking register 100.0:", error);
//       }
//     }
//   };

//   const runWorkflow = async () => {
//     try {
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       await Promise.race([
//         waitForBitToBecomeOne(1410, 0, 1),
//         new Promise((resolve) => resetEvent.once("reset", resolve)),
//       ]);
//       if (resetEvent.listenerCount("reset") === 0) return; // Check if reset occurred
//       logger.info("Received signal from PLC at 1410.0");

//       const scannerData = await comService.readDataSync();
//       if (resetEvent.listenerCount("reset") === 0) return;
//       logger.info(`Scanner data: ${scannerData}`);

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1);
//         logger.info("Scanner data is found, stopping machine");
//         return;
//       }

//       await writeBitsWithRest(1414, 7, 1);
//       const { text, serialNo } = barcodeGenerator.generateBarcodeData();

//       await writeOCRDataToFile(text);
//       if (resetEvent.listenerCount("reset") === 0) return;
//       logger.info("Scanner data is NG, transferred to text file");
//       await writeBitsWithRest(1410, 11, 1);

//       await writeBitsWithRest(1415, 4, 1);
//       logger.info("File transfer confirmation sent to PLC");

//       await Promise.race([
//         waitForBitToBecomeOne(1410, 2, 1),
//         new Promise((resolve) => resetEvent.once("reset", resolve)),
//       ]);
//       if (resetEvent.listenerCount("reset") === 0) return;
//       logger.info("Received signal from PLC at 1410.2");

//       await writeBitsWithRest(1414, 1, 1);
//       logger.info("Triggered scanner bit to PLC");

//       const secondScannerData = await comService.readDataSync();
//       if (resetEvent.listenerCount("reset") === 0) return;
//       logger.info(`Second Scanner data: ${secondScannerData}`);

//       if (secondScannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1);
//         logger.info("Scanner ok to PLC");
//       } else {
//         await writeBitsWithRest(1414, 7, 1);
//         logger.info("Scanner Nok to PLC");
//       }

//       const isDataMatching =
//         await compareScannerDataWithCode(secondScannerData);

//       if (isDataMatching) {
//         await writeBitsWithRest(1414, 3, 1);
//         logger.info("Scanner data matches, sent OK signal to PLC");
//       } else {
//         await writeBitsWithRest(1414, 4, 1);
//         logger.info("Scanner data does not match, sent NG signal to PLC");
//       }

//       await saveToMongoDB({
//         io,
//         serialNumber: serialNo,
//         markingData: text,
//         scannerData: secondScannerData,
//         result: isDataMatching,
//       });

//       logger.info("Scanner workflow completed");

//       await Promise.race([
//         waitForBitToBecomeOne(1410, 12, 1),
//         new Promise((resolve) => resetEvent.once("reset", resolve)),
//       ]);
//       if (resetEvent.listenerCount("reset") === 0) return;
//       await writeBitsWithRest(1414, 0, 1);
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       await writeBitsWithRest(1414, 12, 1);
//     } finally {
//       await comPort.closePort();
//     }
//   };

//   while (true) {
//     resetEvent.removeAllListeners("reset");
//     resetLogged = true;
//     const trackingPromise = trackRegister100();
//     const workflowPromise = runWorkflow();

//     await Promise.race([trackingPromise, workflowPromise]);
//     await resetBits();
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   const resetEvent = new EventEmitter();
//   let isResetting = false;

//   async function resetBits() {
//     try {
//       await writeBitsWithRest(1414, 1, 0, false);
//       await writeBitsWithRest(1414, 3, 0, false);
//       await writeBitsWithRest(1414, 4, 0, false);
//       await writeBitsWithRest(1414, 6, 0, false);
//       await writeBitsWithRest(1414, 7, 0, false);
//       await writeBitsWithRest(1414, 12, 0, false);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   }

//   async function monitorRegister1600() {
//     let previousValue = 0;
//     while (true) {
//       try {
//         const value = await readBit(1600, 0, true);
//         if (value === 1 && previousValue === 0 && !isResetting) {
//           isResetting = true;
//           logger.info("Register 1600.0 became 1, triggering reset and restart");
//           resetEvent.emit("reset");
//           await new Promise((resolve) => setTimeout(resolve, 1000)); // Debounce
//           isResetting = false;
//         }
//         previousValue = value;
//         await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
//       } catch (error) {
//         logger.error("Error monitoring register 1600.0:", error);
//         await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retrying
//       }
//     }
//   }

//   async function runWorkflow() {
//     try {
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       // Main workflow steps
//       await waitForBitToBecomeOne(1410, 0, 1);
//       logger.info("Received signal from PLC at 1410.0");

//       const scannerData = await comService.readDataSync(100 * 1000);
//       logger.info(`Scanner data: ${scannerData}`);

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1, false);
//         logger.info("Scanner data is found, stopping machine");
//         return;
//       }

//       await writeBitsWithRest(1414, 7, 1, false);
//       const { text, serialNo } = barcodeGenerator.generateBarcodeData();

//       await writeOCRDataToFile(text);
//       logger.info("Scanner data is NG, transferred to text file");
//       await writeBitsWithRest(1410, 11, 1, false);

//       await writeBitsWithRest(1415, 4, 1, false);
//       logger.info("File transfer confirmation sent to PLC");

//       await waitForBitToBecomeOne(1410, 2, 1);
//       logger.info("Received signal from PLC at 1410.2");

//       await writeBitsWithRest(1414, 1, 1, false);
//       logger.info("Triggered scanner bit to PLC");

//       const secondScannerData = await comService.readDataSync(100 * 1000);
//       logger.info(`Second Scanner data: ${secondScannerData}`);

//       if (secondScannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1, false);
//         logger.info("Scanner ok to PLC");
//       } else {
//         await writeBitsWithRest(1414, 7, 1, false);
//         logger.info("Scanner Nok to PLC");
//       }

//       const isDataMatching =
//         await compareScannerDataWithCode(secondScannerData);

//       if (isDataMatching) {
//         await writeBitsWithRest(1414, 3, 1, false);
//         logger.info("Scanner data matches, sent OK signal to PLC");
//       } else {
//         await writeBitsWithRest(1414, 4, 1, false);
//         logger.info("Scanner data does not match, sent NG signal to PLC");
//       }

//       await saveToMongoDB({
//         io,
//         serialNumber: serialNo,
//         markingData: text,
//         scannerData: secondScannerData,
//         result: isDataMatching,
//       });

//       logger.info("Scanner workflow completed");

//       await waitForBitToBecomeOne(1410, 12, 1);
//       await writeBitsWithRest(1414, 0, 1, false);
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       await writeBitsWithRest(1414, 12, 1, false);
//     } finally {
//       await comPort.closePort();
//     }
//   }

//   // Start monitoring register 1600.0 in the background
//   monitorRegister1600();

//   while (true) {
//     const workflowPromise = runWorkflow();
//     const resetPromise = new Promise((resolve) =>
//       resetEvent.once("reset", resolve)
//     );

//     await Promise.race([workflowPromise, resetPromise]);

//     if ((await readBit(1600, 0)) === 1) {
//       await resetBits();
//       logger.info("Restarting workflow after reset");
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   const resetEvent = new EventEmitter();
//   let isResetting = false;

//   async function resetBits() {
//     try {
//       await writeBitsWithRest(1414, 1, 0, false);
//       await writeBitsWithRest(1414, 3, 0, false);
//       await writeBitsWithRest(1414, 4, 0, false);
//       await writeBitsWithRest(1414, 6, 0, false);
//       await writeBitsWithRest(1414, 7, 0, false);
//       await writeBitsWithRest(1414, 12, 0, false);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   }

//   async function monitorRegister1600() {
//     while (true) {
//       try {
//         const value = await readBit(1600, 0);
//         if (value === 1) {
//           resetEvent.emit("reset");
//         }
//         await new Promise((resolve) => setTimeout(resolve, 10)); // Check every 10ms for more responsiveness
//       } catch (error) {
//         logger.error("Error monitoring register 1600.0:", error);
//         await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retrying
//       }
//     }
//   }

//   async function runWorkflow() {
//     try {
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       // Main workflow steps
//       await waitForBitToBecomeOne(1410, 0, 1);
//       logger.info("Received signal from PLC at 1410.0");

//       const scannerData = await comService.readDataSync(100 * 1000);
//       logger.info(`Scanner data: ${scannerData}`);

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1, false);
//         logger.info("Scanner data is found, stopping machine");
//         return;
//       }

//       await writeBitsWithRest(1414, 7, 1, false);
//       const { text, serialNo } = barcodeGenerator.generateBarcodeData();

//       await writeOCRDataToFile(text);
//       logger.info("Scanner data is NG, transferred to text file");
//       await writeBitsWithRest(1410, 11, 1, false);

//       await writeBitsWithRest(1415, 4, 1, false);
//       logger.info("File transfer confirmation sent to PLC");

//       await waitForBitToBecomeOne(1410, 2, 1);
//       logger.info("Received signal from PLC at 1410.2");

//       await writeBitsWithRest(1414, 1, 1, false);
//       logger.info("Triggered scanner bit to PLC");

//       const secondScannerData = await comService.readDataSync(100 * 1000);
//       logger.info(`Second Scanner data: ${secondScannerData}`);

//       if (secondScannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1, false);
//         logger.info("Scanner ok to PLC");
//       } else {
//         await writeBitsWithRest(1414, 7, 1, false);
//         logger.info("Scanner Nok to PLC");
//       }

//       const isDataMatching =
//         await compareScannerDataWithCode(secondScannerData);

//       if (isDataMatching) {
//         await writeBitsWithRest(1414, 3, 1, false);
//         logger.info("Scanner data matches, sent OK signal to PLC");
//       } else {
//         await writeBitsWithRest(1414, 4, 1, false);
//         logger.info("Scanner data does not match, sent NG signal to PLC");
//       }

//       await saveToMongoDB({
//         io,
//         serialNumber: serialNo,
//         markingData: text,
//         scannerData: secondScannerData,
//         result: isDataMatching,
//       });

//       logger.info("Scanner workflow completed");

//       await waitForBitToBecomeOne(1410, 12, 1);
//       await writeBitsWithRest(1414, 0, 1, false);
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       await writeBitsWithRest(1414, 12, 1, false);
//     } finally {
//       await comPort.closePort();
//     }
//   }

//   // Start monitoring register 1600.0 in the background
//   monitorRegister1600();

//   while (true) {
//     const workflowPromise = runWorkflow();
//     const resetPromise = new Promise((resolve) =>
//       resetEvent.once("reset", resolve)
//     );

//     const winner = await Promise.race([workflowPromise, resetPromise]);

//     if (winner === undefined) {
//       // resetPromise won
//       if (!isResetting) {
//         isResetting = true;
//         logger.info("Register 1600.0 became 1, triggering reset and restart");
//         await resetBits();
//         logger.info("Restarting workflow after reset");
//         isResetting = false;
//       }
//     }
//   }
// }
// export async function runContinuousScan(io = null, comService) {
//   const READ_TIMEOUT = 100 * 1000; // 100 seconds

//   async function resetBits() {
//     try {
//       await writeBitsWithRest(1414, 1, 0, false);
//       await writeBitsWithRest(1414, 3, 0, false);
//       await writeBitsWithRest(1414, 4, 0, false);
//       await writeBitsWithRest(1414, 6, 0, false);
//       await writeBitsWithRest(1414, 7, 0, false);
//       await writeBitsWithRest(1414, 12, 0, false);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   }

//   async function checkRegister1600() {
//     try {
//       const value = await readBit(1600, 0);
//       console.log({ value });
//       return value === 1;
//     } catch (error) {
//       logger.error("Error reading register 1600.0:", error);
//       return false;
//     }
//   }

//   async function runWorkflowStep(step) {
//     if (await checkRegister1600()) {
//       throw new Error("Reset triggered");
//     }
//     await step();
//   }

//   async function runWorkflow() {
//     try {
//       await runWorkflowStep(() =>
//         mongoDbService.connect("main-data", "records")
//       );
//       await runWorkflowStep(() => comService.initSerialPort());
//       logger.info("Starting scanner workflow");

//       await runWorkflowStep(() => waitForBitToBecomeOne(1410, 0, 1));
//       logger.info("Received signal from PLC at 1410.0");

//       const scannerData = await runWorkflowStep(() =>
//         comService.readDataSync(READ_TIMEOUT)
//       );
//       logger.info(`Scanner data: ${scannerData}`);

//       if (scannerData !== "NG") {
//         await runWorkflowStep(() => writeBitsWithRest(1414, 6, 1, false));
//         logger.info("Scanner data is found, stopping machine");
//         return;
//       }

//       await runWorkflowStep(() => writeBitsWithRest(1414, 7, 1, false));
//       const { text, serialNo } = barcodeGenerator.generateBarcodeData();

//       await runWorkflowStep(() => writeOCRDataToFile(text));
//       logger.info("Scanner data is NG, transferred to text file");
//       await runWorkflowStep(() => writeBitsWithRest(1410, 11, 1, false));

//       await runWorkflowStep(() => writeBitsWithRest(1415, 4, 1, false));
//       logger.info("File transfer confirmation sent to PLC");

//       await runWorkflowStep(() => waitForBitToBecomeOne(1410, 2, 1));
//       logger.info("Received signal from PLC at 1410.2");

//       await runWorkflowStep(() => writeBitsWithRest(1414, 1, 1, false));
//       logger.info("Triggered scanner bit to PLC");

//       const secondScannerData = await runWorkflowStep(() =>
//         comService.readDataSync(READ_TIMEOUT)
//       );
//       logger.info(`Second Scanner data: ${secondScannerData}`);

//       if (secondScannerData !== "NG") {
//         await runWorkflowStep(() => writeBitsWithRest(1414, 6, 1, false));
//         logger.info("Scanner ok to PLC");
//       } else {
//         await runWorkflowStep(() => writeBitsWithRest(1414, 7, 1, false));
//         logger.info("Scanner Nok to PLC");
//       }

//       const isDataMatching = await runWorkflowStep(() =>
//         compareScannerDataWithCode(secondScannerData)
//       );

//       if (isDataMatching) {
//         await runWorkflowStep(() => writeBitsWithRest(1414, 3, 1, false));
//         logger.info("Scanner data matches, sent OK signal to PLC");
//       } else {
//         await runWorkflowStep(() => writeBitsWithRest(1414, 4, 1, false));
//         logger.info("Scanner data does not match, sent NG signal to PLC");
//       }

//       await runWorkflowStep(() =>
//         saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         })
//       );

//       logger.info("Scanner workflow completed");

//       await runWorkflowStep(() => waitForBitToBecomeOne(1410, 12, 1));
//       await runWorkflowStep(() => writeBitsWithRest(1414, 0, 1, false));
//     } catch (error) {
//       if (error.message === "Reset triggered") {
//         logger.info("Reset triggered during workflow execution");
//       } else {
//         logger.error("Error in scanner workflow:", error);
//         await writeBitsWithRest(1414, 12, 1, false);
//       }
//     } finally {
//       await comPort.closePort();
//     }
//   }

//   while (true) {
//     if (await checkRegister1600()) {
//       logger.info("Register 1600.0 is 1, triggering reset");
//       await resetBits();
//       logger.info("Reset complete, restarting workflow");
//       continue;
//     }

//     await runWorkflow();

//     // Short delay to prevent tight loop
//     await new Promise((resolve) => setTimeout(resolve, 100));
//   }
// }
// Main thread code

/* eslint-disable no-use-before-define */
// import { Worker, isMainThread, parentPort, workerData } from "worker_threads";

// Main thread code

// Main thread code
// if (isMainThread) {
//   /* eslint-disable no-inner-declarations */
//   function runContinuousScan(io = null, comService) {
//     const resetEvent = new EventEmitter();

//     // Create a worker for monitoring register 1600
//     const monitorWorker = new Worker(__filename, {
//       workerData: { type: "monitor" },
//     });

//     monitorWorker.on("message", (message) => {
//       if (message.type === "reset") {
//         resetEvent.emit("reset");
//       }
//     });

//     async function resetBits() {
//       try {
//         await writeBitsWithRest(1414, 1, 0, false);
//         await writeBitsWithRest(1414, 3, 0, false);
//         await writeBitsWithRest(1414, 4, 0, false);
//         await writeBitsWithRest(1414, 6, 0, false);
//         await writeBitsWithRest(1414, 7, 0, false);
//         await writeBitsWithRest(1414, 12, 0, false);
//         logger.info("All bits reset to zero");
//       } catch (error) {
//         logger.error("Error resetting bits:", error);
//       }
//     }

//     async function runWorkflow() {
//       const workflowWorker = new Worker(__filename, {
//         workerData: { type: "workflow", io, comService },
//       });

//       return new Promise((resolve, reject) => {
//         workflowWorker.on("message", (message) => {
//           if (message.type === "log") {
//             logger.info(message.content);
//           } else if (message.type === "error") {
//             logger.error(message.content);
//           } else if (message.type === "complete") {
//             resolve();
//           }
//         });

//         workflowWorker.on("error", reject);
//         workflowWorker.on("exit", (code) => {
//           if (code !== 0) {
//             reject(new Error(`Worker stopped with exit code ${code}`));
//           }
//         });
//       });
//     }

//     (async function main() {
//       while (true) {
//         const workflowPromise = runWorkflow();
//         const resetPromise = new Promise((resolve) =>
//           resetEvent.once("reset", resolve)
//         );

//         const winner = await Promise.race([workflowPromise, resetPromise]);

//         if (winner === undefined) {
//           // resetPromise won
//           logger.info("Register 1600.0 became 1, triggering reset and restart");
//           await resetBits();
//           logger.info("Restarting workflow after reset");
//         }

//         // Short delay to prevent tight loop
//         await new Promise((resolve) => setTimeout(resolve, 100));
//       }
//     })();
//   }
//   /* eslint-enable no-inner-declarations */

//   // Export the main function
//   module.exports = { runContinuousScan };
// } else {
//   // Worker thread code
//   // eslint-disable-next-line no-lonely-if
//   if (workerData.type === "monitor") {
//     // Monitor register 1600
//     /* eslint-disable no-inner-declarations */
//     async function monitorRegister1600() {
//       while (true) {
//         try {
//           const value = await readBit(1600, 0);
//           if (value === 1) {
//             parentPort.postMessage({ type: "reset" });
//           }
//           await new Promise((resolve) => setTimeout(resolve, 10)); // Check every 10ms
//         } catch (error) {
//           parentPort.postMessage({
//             type: "error",
//             content: `Error monitoring register 1600.0: ${error.message}`,
//           });
//           await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retrying
//         }
//       }
//     }
//     /* eslint-enable no-inner-declarations */

//     monitorRegister1600();
//   } else if (workerData.type === "workflow") {
//     // Run the main workflow
//     /* eslint-disable no-inner-declarations */
//     async function runWorkflow() {
//       const READ_TIMEOUT = 100 * 1000; // 100 seconds
//       const { io, comService } = workerData;

//       try {
//         await mongoDbService.connect("main-data", "records");
//         await comService.initSerialPort();
//         parentPort.postMessage({
//           type: "log",
//           content: "Starting scanner workflow",
//         });

//         await waitForBitToBecomeOne(1410, 0, 1);
//         parentPort.postMessage({
//           type: "log",
//           content: "Received signal from PLC at 1410.0",
//         });

//         const scannerData = await comService.readDataSync(READ_TIMEOUT);
//         parentPort.postMessage({
//           type: "log",
//           content: `Scanner data: ${scannerData}`,
//         });

//         if (scannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1, false);
//           parentPort.postMessage({
//             type: "log",
//             content: "Scanner data is found, stopping machine",
//           });
//           return;
//         }

//         await writeBitsWithRest(1414, 7, 1, false);
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();

//         await writeOCRDataToFile(text);
//         parentPort.postMessage({
//           type: "log",
//           content: "Scanner data is NG, transferred to text file",
//         });
//         await writeBitsWithRest(1410, 11, 1, false);

//         await writeBitsWithRest(1415, 4, 1, false);
//         parentPort.postMessage({
//           type: "log",
//           content: "File transfer confirmation sent to PLC",
//         });

//         await waitForBitToBecomeOne(1410, 2, 1);
//         parentPort.postMessage({
//           type: "log",
//           content: "Received signal from PLC at 1410.2",
//         });

//         await writeBitsWithRest(1414, 1, 1, false);
//         parentPort.postMessage({
//           type: "log",
//           content: "Triggered scanner bit to PLC",
//         });

//         const secondScannerData = await comService.readDataSync(READ_TIMEOUT);
//         parentPort.postMessage({
//           type: "log",
//           content: `Second Scanner data: ${secondScannerData}`,
//         });

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1, false);
//           parentPort.postMessage({ type: "log", content: "Scanner ok to PLC" });
//         } else {
//           await writeBitsWithRest(1414, 7, 1, false);
//           parentPort.postMessage({
//             type: "log",
//             content: "Scanner Nok to PLC",
//           });
//         }

//         const isDataMatching =
//           await compareScannerDataWithCode(secondScannerData);

//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1, false);
//           parentPort.postMessage({
//             type: "log",
//             content: "Scanner data matches, sent OK signal to PLC",
//           });
//         } else {
//           await writeBitsWithRest(1414, 4, 1, false);
//           parentPort.postMessage({
//             type: "log",
//             content: "Scanner data does not match, sent NG signal to PLC",
//           });
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });

//         parentPort.postMessage({
//           type: "log",
//           content: "Scanner workflow completed",
//         });

//         await waitForBitToBecomeOne(1410, 12, 1);
//         await writeBitsWithRest(1414, 0, 1, false);
//       } catch (error) {
//         parentPort.postMessage({
//           type: "error",
//           content: `Error in scanner workflow: ${error.message}`,
//         });
//         await writeBitsWithRest(1414, 12, 1, false);
//       } finally {
//         await comPort.closePort();
//       }

//       parentPort.postMessage({ type: "complete" });
//     }
//     /* eslint-enable no-inner-declarations */

//     runWorkflow();
//   }
// }

// export async function runContinuousScan2(io = null, comService) {
//   let r = 0;
//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0); // Reset bit 1414.1
//       await writeBitsWithRest(1414, 3, 0); // Reset bit 1414.3
//       await writeBitsWithRest(1414, 4, 0); // Reset bit 1414.4
//       await writeBitsWithRest(1414, 6, 0); // Reset bit 1414.6
//       await writeBitsWithRest(1414, 7, 0); // Reset bit 1414.7
//       // await writeBitsWithRest(1414, 12, 0); // Reset bit 1414.12
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   const checkResetSignal = async () => {
//     while (true) {
//       const resetSignal = await readBit(1600, 0);
//       if (resetSignal) {
//         await resetBits();
//         logger.info(
//           "Reset signal detected at register 1600 bit 0. Restarting cycle..."
//         );
//         r++;
//         console.log({ r });
//         return true; // Return true to indicate that a reset has occurred
//       }
//       await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100 ms
//     }
//   };

//   const awaitWithResetCheck = async (operation) => {
//     return await Promise.race([
//       operation,
//       checkResetSignal().then((resetOccurred) => {
//         if (resetOccurred)
//           // continue;
//           throw new Error("Reset signal detected, restarting.");
//       }),
//     ]);
//   };
//   await connect();

//   while (true) {
//     try {
//       console.log("Counter", c + 1);
//       await awaitWithResetCheck(mongoDbService.connect("main-data", "records"));
//       await awaitWithResetCheck(comService.initSerialPort());
//       logger.info("Starting scanner workflow");

//       await awaitWithResetCheck(waitForBitToBecomeOne(1410, 0, 1));
//       logger.info("Received signal from PLC at 1410.0");

//       const scannerData = await awaitWithResetCheck(comService.readDataSync());
//       logger.info(`Scanner data: ${scannerData}`);

//       if (scannerData !== "NG") {
//         await awaitWithResetCheck(writeBitsWithRest(1414, 6, 1));
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await awaitWithResetCheck(writeBitsWithRest(1414, 7, 1));
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         await writeOCRDataToFile(text);
//         logger.info("Scanner data is NG, transferred to text file");
//         await awaitWithResetCheck(writeBitsWithRest(1410, 11, 1));

//         await awaitWithResetCheck(writeBitsWithRest(1415, 4, 1));
//         logger.info("File transfer confirmation sent to PLC");

//         await awaitWithResetCheck(waitForBitToBecomeOne(1410, 2, 1));
//         logger.info("Received signal from PLC at 1410.2");

//         await awaitWithResetCheck(writeBitsWithRest(1414, 1, 1));
//         const secondScannerData = await awaitWithResetCheck(
//           comService.readDataSync()
//         );
//         logger.info(`Second Scanner data: ${secondScannerData}`);

//         if (secondScannerData !== "NG") {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 6, 1));
//           logger.info("Scanner ok to PLC");
//         } else {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 7, 1));
//           logger.info("Scanner Nok to PLC");
//         }

//         const isDataMatching = await awaitWithResetCheck(
//           compareScannerDataWithCode(secondScannerData)
//         );
//         if (isDataMatching) {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 3, 1));
//           logger.info("Scanner data matches, sent OK signal to PLC");
//         } else {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 4, 1));
//           logger.info("Scanner data does not match, sent NG signal to PLC");
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });
//         logger.info("Scanner workflow completed");

//         await awaitWithResetCheck(waitForBitToBecomeOne(1410, 12, 1));
//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       if (error.message === "Reset signal detected, restarting.") {
//         logger.info(
//           "Cycle reset due to detected reset signal. Restarting loop."
//         );
//       } else {
//         logger.error("Error in scanner workflow:", error);
//         await writeBitsWithRest(1414, 12, 1);
//       }
//     } finally {
//       await comPort.closePort();
//     }
//   }
// }

// export async function runContinuousScan3(io = null, comService) {
//   let r = 0;
//   let c = 0;

//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0); // Reset bit 1414.1
//       await writeBitsWithRest(1414, 3, 0); // Reset bit 1414.3
//       await writeBitsWithRest(1414, 4, 0); // Reset bit 1414.4
//       await writeBitsWithRest(1414, 6, 0); // Reset bit 1414.6
//       await writeBitsWithRest(1414, 7, 0); // Reset bit 1414.7
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   const checkResetSignal = async () => {
//     const resetSignal = await readBit(1600, 0);
//     if (resetSignal) {
//       await resetBits();
//       logger.info(
//         "Reset signal detected at register 1600 bit 0. Restarting cycle..."
//       );
//       r++;
//       console.log({ r });
//       return true;
//     }
//     return false;
//   };

//   const awaitWithResetCheck = async (operation) => {
//     while (true) {
//       if (await checkResetSignal()) {
//         continue;
//       }
//       try {
//         return await Promise.race([
//           operation,
//           new Promise((_, reject) =>
//             setTimeout(() => reject(new Error("Operation timeout")), 5000)
//           ),
//         ]);
//       } catch (error) {
//         if (error.message === "Operation timeout") {
//           logger.warn("Operation timed out, checking reset signal again");
//           continue;
//         }
//         throw error;
//       }
//     }
//   };

//   const waitForBitToBecomeOne = async (register, bit, value) => {
//     while (true) {
//       const bitValue = await readBit(register, bit);
//       if (bitValue === value) {
//         return;
//       }
//       await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100 ms
//     }
//   };

//   await connect();

//   while (true) {
//     try {
//       console.log("Counter", c + 1);
//       await awaitWithResetCheck(mongoDbService.connect("main-data", "records"));
//       await awaitWithResetCheck(comService.initSerialPort());
//       logger.info("Starting scanner workflow");

//       await awaitWithResetCheck(waitForBitToBecomeOne(1410, 0, 1));
//       logger.info("Received signal from PLC at 1410.0");

//       const scannerData = await awaitWithResetCheck(
//         comService.readDataSync(100 * 1000)
//       );
//       logger.info(`Scanner data: ${scannerData}`);

//       if (scannerData !== "NG") {
//         await awaitWithResetCheck(writeBitsWithRest(1414, 6, 1));
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await awaitWithResetCheck(writeBitsWithRest(1414, 7, 1));
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         await writeOCRDataToFile(text);
//         logger.info("Scanner data is NG, transferred to text file");
//         await awaitWithResetCheck(writeBitsWithRest(1410, 11, 1));

//         await awaitWithResetCheck(writeBitsWithRest(1415, 4, 1));
//         logger.info("File transfer confirmation sent to PLC");

//         await awaitWithResetCheck(waitForBitToBecomeOne(1410, 2, 1));
//         logger.info("Received signal from PLC at 1410.2");

//         await awaitWithResetCheck(writeBitsWithRest(1414, 1, 1));
//         const secondScannerData = await awaitWithResetCheck(
//           comService.readDataSync(100 * 1000)
//         );
//         logger.info(`Second Scanner data: ${secondScannerData}`);

//         if (secondScannerData !== "NG") {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 6, 1));
//           logger.info("Scanner ok to PLC");
//         } else {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 7, 1));
//           logger.info("Scanner Nok to PLC");
//         }

//         const isDataMatching = await awaitWithResetCheck(
//           compareScannerDataWithCode(secondScannerData)
//         );
//         if (isDataMatching) {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 3, 1));
//           logger.info("Scanner data matches, sent OK signal to PLC");
//         } else {
//           await awaitWithResetCheck(writeBitsWithRest(1414, 4, 1));
//           logger.info("Scanner data does not match, sent NG signal to PLC");
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });
//         logger.info("Scanner workflow completed");

//         await awaitWithResetCheck(waitForBitToBecomeOne(1410, 12, 1));
//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       await writeBitsWithRest(1414, 12, 1);
//     } finally {
//       await comService.closePort();
//     }
//   }
// }

// export async function runContinuousScan(io = null, comService) {
//   let r = 0;
//   let c = 0;

//   const resetBits = async () => {
//     try {
//       await writeBitsWithRest(1414, 1, 0);
//       await writeBitsWithRest(1414, 3, 0);
//       await writeBitsWithRest(1414, 4, 0);
//       await writeBitsWithRest(1414, 6, 0);
//       await writeBitsWithRest(1414, 7, 0);
//       logger.info("All bits reset to zero");
//     } catch (error) {
//       logger.error("Error resetting bits:", error);
//     }
//   };

//   const checkResetSignal = async () => {
//     const resetSignal = await readBit(1600, 0);
//     if (resetSignal) {
//       await resetBits();
//       logger.info(
//         "Reset signal detected at register 1600 bit 0. Restarting cycle..."
//       );
//       r++;
//       console.log({ r });
//       return true;
//     }
//     return false;
//   };

//   const waitForBitToBecomeOne = async (register, bit, value) => {
//     while (true) {
//       const bitValue = await readBit(register, bit);
//       if (bitValue === value) {
//         return;
//       }
//       await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100 ms
//     }
//   };

//   await connect();

//   while (true) {
//     try {
//       if (await checkResetSignal()) {
//         logger.info("Reset signal detected. Restarting the main loop.");
//         continue; // This will restart the main while loop from the beginning
//       }

//       console.log("Counter", c + 1);
//       await mongoDbService.connect("main-data", "records");
//       await comService.initSerialPort();
//       logger.info("Starting scanner workflow");

//       await waitForBitToBecomeOne(1410, 0, 1);
//       logger.info("Received signal from PLC at 1410.0");

//       const scannerData = await comService.readDataSync();
//       logger.info(`Scanner data: ${scannerData}`);

//       if (await checkResetSignal()) continue; // Check reset signal after each major step

//       if (scannerData !== "NG") {
//         await writeBitsWithRest(1414, 6, 1);
//         logger.info("Scanner data is found, stopping machine");
//         continue;
//       } else {
//         await writeBitsWithRest(1414, 7, 1);
//         const { text, serialNo } = barcodeGenerator.generateBarcodeData();
//         await writeOCRDataToFile(text);
//         logger.info("Scanner data is NG, transferred to text file");
//         await writeBitsWithRest(1410, 11, 1);

//         if (await checkResetSignal()) continue; // Check reset signal after file operations

//         await writeBitsWithRest(1415, 4, 1);
//         logger.info("File transfer confirmation sent to PLC");

//         await waitForBitToBecomeOne(1410, 2, 1);
//         logger.info("Received signal from PLC at 1410.2");

//         if (await checkResetSignal()) continue; // Check reset signal before second scan

//         await writeBitsWithRest(1414, 1, 1);
//         const secondScannerData = await comService.readDataSync();
//         logger.info(`Second Scanner data: ${secondScannerData}`);

//         if (secondScannerData !== "NG") {
//           await writeBitsWithRest(1414, 6, 1);
//           logger.info("Scanner ok to PLC");
//         } else {
//           await writeBitsWithRest(1414, 7, 1);
//           logger.info("Scanner Nok to PLC");
//         }

//         if (await checkResetSignal()) continue; // Check reset signal after second scan

//         const isDataMatching =
//           await compareScannerDataWithCode(secondScannerData);
//         if (isDataMatching) {
//           await writeBitsWithRest(1414, 3, 1);
//           logger.info("Scanner data matches, sent OK signal to PLC");
//         } else {
//           await writeBitsWithRest(1414, 4, 1);
//           logger.info("Scanner data does not match, sent NG signal to PLC");
//         }

//         await saveToMongoDB({
//           io,
//           serialNumber: serialNo,
//           markingData: text,
//           scannerData: secondScannerData,
//           result: isDataMatching,
//         });
//         logger.info("Scanner workflow completed");

//         if (await checkResetSignal()) continue; // Final reset check before completing cycle

//         await waitForBitToBecomeOne(1410, 12, 1);
//         c++;
//         await resetBits();
//       }
//     } catch (error) {
//       logger.error("Error in scanner workflow:", error);
//       await writeBitsWithRest(1414, 12, 1);
//     } finally {
//       await comService.closePort();
//     }
//   }
// }

export async function runContinuousScan33(io = null, comService) {
  const MAX_RETRIES = 3; // Max retry attempts for connections
  const RETRY_DELAY = 2000; // Delay in ms between retries
  let resetCounter = 0;
  let cycleCounter = 0;

  const resetBits = async () => {
    try {
      await writeBitsWithRest(1414, 1, 0);
      await writeBitsWithRest(1414, 3, 0);
      await writeBitsWithRest(1414, 4, 0);
      await writeBitsWithRest(1414, 6, 0);
      await writeBitsWithRest(1414, 7, 0);
      logger.info("All bits reset to zero");
    } catch (error) {
      logger.error("Error resetting bits:", error);
    }
  };

  const checkResetSignal = async () => {
    try {
      const resetSignal = await readBit(1600, 0);
      if (resetSignal) {
        await resetBits();
        logger.warn("Reset signal detected at 1600.0. Restarting cycle...");
        resetCounter++;
        return true;
      }
    } catch (error) {
      logger.error("Error reading reset signal from 1600.0:", error);
    }
    return false;
  };

  const retryOperation = async (operation, maxRetries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        logger.warn(
          `Retry ${attempt}/${maxRetries} for operation. Error: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  };

  const ensureConnection = async () => {
    await retryOperation(() => mongoDbService.connect("main-data", "records"));
    await retryOperation(() => comService.initSerialPort());
    logger.info(
      "Successfully connected to MongoDB and initialized serial port."
    );
  };

  const waitForBit = async (register, bit, expectedValue) => {
    while (true) {
      try {
        const currentBitValue = await readBit(register, bit);
        if (currentBitValue === expectedValue) return;
      } catch (error) {
        logger.error(
          `Error reading bit ${bit} at register ${register}:`,
          error
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100)); // Poll every 100ms
      if (await checkResetSignal()) throw new Error("Reset detected");
    }
  };

  await retryOperation(connect);

  while (true) {
    try {
      if (await checkResetSignal()) continue;

      logger.info(`Starting scan cycle ${cycleCounter + 1}`);
      await ensureConnection();

      await waitForBit(1410, 0, 1);
      logger.info("Received signal from PLC at 1410.0");

      const scannerData = await comService.readDataSync();
      logger.info(`Scanner data: ${scannerData}`);

      if (await checkResetSignal()) continue;

      if (scannerData !== "NG") {
        await writeBitsWithRest(1414, 6, 1);
        logger.info("Scanner data is valid. Stopping machine.");
        continue;
      } else {
        await writeBitsWithRest(1414, 7, 1);
        const { text, serialNo } = barcodeGenerator.generateBarcodeData();
        await writeOCRDataToFile(text);
        logger.info("Scanner data is NG, written to text file.");
        await writeBitsWithRest(1410, 11, 1);

        if (await checkResetSignal()) continue;

        await writeBitsWithRest(1415, 4, 1);
        logger.info("File transfer confirmation sent to PLC.");

        await waitForBit(1410, 2, 1);
        logger.info("Received signal from PLC at 1410.2");

        if (await checkResetSignal()) continue;

        await writeBitsWithRest(1414, 1, 1);
        const secondScannerData = await comService.readDataSync();
        logger.info(`Second Scanner data: ${secondScannerData}`);

        if (secondScannerData !== "NG") {
          await writeBitsWithRest(1414, 6, 1);
          logger.info("Second scanner data OK.");
        } else {
          await writeBitsWithRest(1414, 7, 1);
          logger.info("Second scanner data NG.");
        }

        if (await checkResetSignal()) continue;

        const isDataMatching =
          await compareScannerDataWithCode(secondScannerData);
        if (isDataMatching) {
          await writeBitsWithRest(1414, 3, 1);
          logger.info("Data matches. Sent OK signal to PLC.");
        } else {
          await writeBitsWithRest(1414, 4, 1);
          logger.info("Data mismatch. Sent NG signal to PLC.");
        }

        await saveToMongoDB({
          io,
          serialNumber: serialNo,
          markingData: text,
          scannerData: secondScannerData,
          result: isDataMatching,
        });
        logger.info("Data saved to MongoDB. Workflow complete.");

        if (await checkResetSignal()) continue;

        await waitForBit(1410, 12, 1);
        cycleCounter++;
        await resetBits();
      }
    } catch (error) {
      if (error.message === "Reset detected") {
        logger.warn("Reset detected. Restarting cycle.");
      } else {
        logger.error("Error in scanner workflow:", error);
        await writeBitsWithRest(1414, 12, 1);
      }
    } finally {
      await comService.closePort();
    }
  }
}

export async function runContinuousScan45(io = null, comService) {
  // eslint-disable-next-line no-constant-condition

  const resetBits = async () => {
    try {
      // await writeBitsWithRest(1414, 0, 0); // Reset bit 1414.0
      await writeBitsWithRest(1414, 1, 0); // Reset bit 1414.1
      await writeBitsWithRest(1414, 3, 0); // Reset bit 1414.3
      await writeBitsWithRest(1414, 4, 0); // Reset bit 1414.4
      await writeBitsWithRest(1414, 6, 0); // Reset bit 1414.6
      await writeBitsWithRest(1414, 7, 0); // Reset bit 1414.7
      await writeBitsWithRest(1414, 12, 0); // Reset bit 1414.12
      logger.info("All bits reset to zero");
    } catch (error) {
      logger.error("Error resetting bits:", error);
    }
  };

  while (true) {
    try {
      console.log("Counter", c + 1);
      // if (c == 1) {
      //   logger.info(" CYCLE ONE OVER");
      //   return;
      // }
      await mongoDbService.connect("main-data", "records");
      // await comPort.initSerialPort();
      await comService.initSerialPort();
      logger.info("Starting scanner workflow");

      // 1. Start
      // await writeBitsWithRest(1410, 0, 1, 30000);
      await waitForBitToBecomeOne(1410, 0, 1);
      logger.info("Received signal from PLC at 1410.0");

      // 2-3. Read scanner data from s/w
      // let scannerData = "";
      // await comService.readData((line) => {
      //   // console.log("Received data:", line);
      //   scannerData = line;
      // });
      const scannerData = await comService.readDataSync();
      // logger.info(`Second scanner data: ${secondScannerData}`);
      logger.info(`Scanner data: ${scannerData}`);

      // 4-5. Check if data is OK or NG
      if (scannerData !== "NG") {
        await writeBitsWithRest(1414, 6, 1); // Signal  to PLC
        logger.info("Scanner data is found, stopping machine");
        continue; // Exit the function if NG
      } else {
        console.log("her1");
        await writeBitsWithRest(1414, 7, 1); // Signal  to PLC
        const { text, serialNo } = barcodeGenerator.generateBarcodeData();
        console.log("her1");

        await writeOCRDataToFile(text);
        logger.info("Scanner data is NG, transferred to text file");
        await writeBitsWithRest(1410, 11, 1); // Signal  to PLC

        // 6.MARKING START BIT FROM S/W TO PLC
        await writeBitsWithRest(1415, 4, 1);
        logger.info("File transfer confirmation sent to PLC");

        // // 7. Get signal from PLC at 1414.2
        await waitForBitToBecomeOne(1410, 2, 1);
        logger.info("Received signal from PLC at 1410.2");

        // 8. Trigger scanner on bit now to PLC
        await writeBitsWithRest(1414, 1, 1);
        logger.info("Triggered scanner bit to PLC");

        // 9. Read scanner data now
        // const secondScannerData = await comPort.readData();
        // logger.info(`Second scanner data: ${secondScannerData}`);
        // let secondScannerData = "";
        // await comService.readData((line) => {
        //   // console.log("Received data:", line);
        //   secondScannerData = line;
        // });
        const secondScannerData = await comService.readDataSync();
        // logger.info(`Second scanner data: ${secondScannerData}`);
        logger.info(`Second Scanner data: ${secondScannerData}`);

        if (secondScannerData !== "NG") {
          await writeBitsWithRest(1414, 6, 1); // Signal  to PLC
          logger.info("Scanner ok to PLC");
        } else {
          await writeBitsWithRest(1414, 7, 1); // Signal  to PLC
          logger.info("Scanner Nok to PLC");
        }

        // 10. Compare scanner results
        const isDataMatching =
          await compareScannerDataWithCode(secondScannerData);

        // 11. Final give ok nok to PLC
        if (isDataMatching) {
          await writeBitsWithRest(1414, 3, 1); // OK signal
          logger.info("Scanner data matches, sent OK signal to PLC");
        } else {
          await writeBitsWithRest(1414, 4, 1); // NG signal
          logger.info("Scanner data does not match, sent NG signal to PLC");
        }
        await saveToMongoDB({
          io,
          serialNumber: serialNo,
          markingData: text,
          scannerData: secondScannerData,
          result: isDataMatching,
        });
        logger.info("Scanner workflow completed");

        // Optional: Add a small delay between cycles if needed
        // await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
        // / 7. Get signal from PLC at 1410.12
        await waitForBitToBecomeOne(1410, 12, 1);
        // reset al registgers over here if we get 1414.6 oir 1414.7 as 1

        // await new Promise((resolve) => setTimeout(resolve, 10 * 1000));

        // await writeBitsWithRest(1414, 0, 1);

        // logger.info("Received signal from PLC at 1410.2");
        c++;
        await resetBits();
      }
    } catch (error) {
      console.log({ error });
      logger.error("Error in scanner workflow:", error);
      // Implement error handling, possibly signaling an error to the PLC
      // await writeBitsWithRest(1414, 12, 1); // NG signal in case of error
    } finally {
      // await comPort.closePort();
    }
  }
}
export async function runContinuousScan56(io = null, comService) {
  let c = 0;

  const resetBits = async () => {
    try {
      await writeBitsWithRest(1414, 1, 0);
      await writeBitsWithRest(1414, 3, 0);
      await writeBitsWithRest(1414, 4, 0);
      await writeBitsWithRest(1414, 6, 0);
      await writeBitsWithRest(1414, 7, 0);
      await writeBitsWithRest(1414, 12, 0);
      logger.info("All bits reset to zero");
    } catch (error) {
      logger.error("Error resetting bits:", error);
    }
  };

  const checkResetSignal = async () => {
    const resetSignal = await readBit(1600, 0);
    if (resetSignal) {
      logger.info(
        "Reset signal detected at register 1600 bit 0. Restarting cycle..."
      );
      await resetBits();
      return true;
    }
    return false;
  };

  while (true) {
    try {
      if (await checkResetSignal()) {
        continue; // Restart the loop if reset signal is detected
      }

      console.log("Counter", c + 1);
      await mongoDbService.connect("main-data", "records");
      await comService.initSerialPort();
      logger.info("Starting scanner workflow");

      if (await checkResetSignal()) continue;

      await waitForBitToBecomeOne(1410, 0, 1);
      logger.info("Received signal from PLC at 1410.0");

      if (await checkResetSignal()) continue;

      const scannerData = await comService.readDataSync();
      logger.info(`Scanner data: ${scannerData}`);

      if (await checkResetSignal()) continue;

      if (scannerData !== "NG") {
        await writeBitsWithRest(1414, 6, 1);
        logger.info("Scanner data is found, stopping machine");
        continue;
      } else {
        await writeBitsWithRest(1414, 7, 1);
        const { text, serialNo } = barcodeGenerator.generateBarcodeData();

        if (await checkResetSignal()) continue;

        await writeOCRDataToFile(text);
        logger.info("Scanner data is NG, transferred to text file");
        await writeBitsWithRest(1410, 11, 1);

        if (await checkResetSignal()) continue;

        await writeBitsWithRest(1415, 4, 1);
        logger.info("File transfer confirmation sent to PLC");

        if (await checkResetSignal()) continue;

        await waitForBitToBecomeOne(1410, 2, 1);
        logger.info("Received signal from PLC at 1410.2");

        if (await checkResetSignal()) continue;

        await writeBitsWithRest(1414, 1, 1);
        logger.info("Triggered scanner bit to PLC");

        if (await checkResetSignal()) continue;

        const secondScannerData = await comService.readDataSync();
        logger.info(`Second Scanner data: ${secondScannerData}`);

        if (await checkResetSignal()) continue;

        if (secondScannerData !== "NG") {
          await writeBitsWithRest(1414, 6, 1);
          logger.info("Scanner ok to PLC");
        } else {
          await writeBitsWithRest(1414, 7, 1);
          logger.info("Scanner Nok to PLC");
        }

        if (await checkResetSignal()) continue;

        const isDataMatching =
          await compareScannerDataWithCode(secondScannerData);

        if (await checkResetSignal()) continue;

        if (isDataMatching) {
          await writeBitsWithRest(1414, 3, 1);
          logger.info("Scanner data matches, sent OK signal to PLC");
        } else {
          await writeBitsWithRest(1414, 4, 1);
          logger.info("Scanner data does not match, sent NG signal to PLC");
        }

        if (await checkResetSignal()) continue;

        await saveToMongoDB({
          io,
          serialNumber: serialNo,
          markingData: text,
          scannerData: secondScannerData,
          result: isDataMatching,
        });
        logger.info("Scanner workflow completed");

        if (await checkResetSignal()) continue;

        await waitForBitToBecomeOne(1410, 12, 1);
        c++;
        await resetBits();
      }
    } catch (error) {
      console.log({ error });
      logger.error("Error in scanner workflow:", error);
    } finally {
      // await comService.closePort();
    }
  }
}
// code to test servce
// runContinuousScan(null,comService).catch((error) => {
//   logger.error("Failed to start continuous scan:", error);
//   process.exit(1);
// });

const resetEmitter = new EventEmitter();

let lastResetTime = 0;
const RESET_COOLDOWN = 1000; // 1 second cooldown between resets

async function monitorResetSignal() {
  logger.info("Starting reset signal monitor");
  while (true) {
    try {
      const resetSignal = await readBit(1600, 0);
      logger.debug(`Reset signal (1600.0) value: ${resetSignal}`);

      if (resetSignal) {
        const currentTime = Date.now();
        if (currentTime - lastResetTime > RESET_COOLDOWN) {
          logger.info(
            "Reset signal detected (1600.0 is 1). Emitting reset event."
          );
          resetEmitter.emit("reset");
          lastResetTime = currentTime;

          // Wait for the bit to be cleared
          logger.info("Waiting for reset signal to clear...");
          while (await readBit(1600, 0)) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          logger.info("Reset signal cleared.");
        } else {
          logger.debug("Reset signal detected but ignored due to cooldown.");
        }
      }
    } catch (error) {
      logger.error("Error in monitorResetSignal:", error);
    }

    // Add a small delay between checks
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// async function waitForBitToBecomeOne(register, bit, value) {
//   return new Promise((resolve, reject) => {
//     const checkBit = async () => {
//       try {
//         while (true) {
//           const bitValue = await readBit(register, bit);
//           if (bitValue === value) {
//             resolve("bitChanged");
//             return;
//           }
//           await new Promise((r) => setTimeout(r, 50)); // Check every 50ms
//         }
//       } catch (error) {
//         reject(error);
//       }
//     };

//     const resetHandler = () => {
//       resolve("reset");
//     };

//     resetEmitter.once("reset", resetHandler);
//     checkBit().finally(() => {
//       resetEmitter.removeListener("reset", resetHandler);
//     });
//   });
// }

const sleep = promisify(setTimeout);

export async function runContinuousScan98(io = null, comService) {
  let c = 0;

  // Start the reset signal monitor
  monitorResetSignal();

  // Catch unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  while (true) {
    try {
      logger.info(`Starting scan cycle ${c + 1}`);

      // Connect to MongoDB
      try {
        await mongoDbService.connect("main-data", "records");
        logger.info("Connected to MongoDB");
      } catch (dbError) {
        logger.error("Failed to connect to MongoDB:", dbError);
        await sleep(5000); // Wait 5 seconds before retrying
        continue;
      }

      // Initialize serial port
      try {
        await comService.initSerialPort();
        logger.info("Initialized serial port");
      } catch (comError) {
        logger.error("Failed to initialize serial port:", comError);
        await sleep(5000); // Wait 5 seconds before retrying
        continue;
      }

      logger.info("Starting scanner workflow");

      // Wait for initial signal
      if (await checkResetOrBit(1410, 0, 1)) {
        logger.info("Reset detected, restarting cycle");
        continue;
      }
      logger.info("Starting to read first Scan");
      // First scan
      let scannerData;
      try {
        scannerData = await comService.readDataSync();
        logger.info(`Scanner data: ${scannerData}`);
      } catch (scanError) {
        logger.error("Error reading scanner data:", scanError);
        await handleError(scanError);
        continue;
      }

      if (scannerData !== "NG") {
        await writeBitsWithRest(1414, 6, 1, false);
        logger.info("Scanner data is found, stopping machine");
        continue;
      }

      // Handle NG case
      await writeBitsWithRest(1414, 7, 1, false);
      const { text, serialNo } = barcodeGenerator.generateBarcodeData();
      await writeOCRDataToFile(text);
      logger.info("Scanner data is NG, transferred to text file");
      await writeBitsWithRest(1410, 11, 1, false);

      if (await checkReset()) {
        logger.info("Reset detected, restarting cycle");
        continue;
      }

      // ... Rest of your existing logic ...

      logger.info("Scanner workflow completed");

      // Wait for final signal
      if (await checkResetOrBit(1410, 12, 1)) {
        logger.info("Reset detected, restarting cycle");
        continue;
      }

      c++;
      await resetBits();
      logger.info(`Completed scan cycle ${c}`);
    } catch (error) {
      logger.error("Unexpected error in scanner workflow:", error);
      await handleError(error);
      await sleep(5000); // Wait 5 seconds before retrying
    }

    // Small delay to prevent tight looping
    await sleep(100);
  }
}
async function waitForBitToBecomeOne(register, bit, value) {
  logger.debug(`awaiting ${register} , bit ${bit}`);
  return new Promise((resolve, reject) => {
    const checkBit = async () => {
      try {
        while (true) {
          const bitValue = await readBit(register, bit);
          if (bitValue === value) {
            resolve("bitChanged");
            return;
          }
          await sleep(50);
        }
      } catch (error) {
        reject(error);
      }
    };

    const resetHandler = () => {
      resolve("reset");
    };

    resetEmitter.on("reset", resetHandler);
    checkBit().finally(() => {
      resetEmitter.removeListener("reset", resetHandler);
    });
  });
}

async function checkResetOrBit(register, bit, value) {
  try {
    const result = await waitForBitToBecomeOne(register, bit, value);
    if (result === "reset") {
      logger.info(`Reset detected while waiting for ${register}.${bit}.`);
      await resetBits();
      return true;
    }
    logger.info(`Received signal from PLC at ${register}.${bit}`);
    return false;
  } catch (error) {
    logger.error(`Error in checkResetOrBit for ${register}.${bit}:`, error);
    return true;
  }
}

async function resetBits() {
  try {
    // await writeBitsWithRest(1414, 1, 0, false);
    await writeBitsWithRest(1414, 3, 0, false);
    await writeBitsWithRest(1414, 4, 0, false);
    await writeBitsWithRest(1414, 6, 0, false);
    await writeBitsWithRest(1414, 7, 0, false);
    // await writeBitsWithRest(1414, 12, 0, false);
    logger.info("All bits reset to zero");
  } catch (error) {
    logger.error("Error resetting bits:", error);
  }
}

async function handleError(error) {
  console.log({ error });
  try {
    await writeBitsWithRest(1414, 12, 1, false);
  } catch (secondaryError) {
    logger.error("Error during error handling:", secondaryError);
  }
}

export async function runContinuousScan(io = null, comService) {
  let c = 0;

  monitorResetSignal();

  while (true) {
    try {
      logger.info(`Starting scan cycle ${c + 1}`);

      try {
        await mongoDbService.connect("main-data", "records");
        logger.info("Connected to MongoDB");
      } catch (dbError) {
        logger.error("Failed to connect to MongoDB:", dbError);
        await sleep(5000);
        continue;
      }

      try {
        await comService.initSerialPort();
        logger.info("Initialized serial port");
      } catch (comError) {
        logger.error("Failed to initialize serial port:", comError);
        await sleep(5000);
        continue;
      }

      logger.info("Starting scanner workflow");

      // const resetDetected = await checkResetOrBit(1410, 0, 1);
      // if (resetDetected) {
      //   logger.info("Reset detected, restarting cycle immediately");
      //   continue;
      // }

      logger.info("=== STARTING FIRST SCAN ===");
      let scannerData;
      try {
        scannerData = await comService.readDataSync();
        logger.info(`First scan data: ${scannerData}`);
      } catch (scanError) {
        logger.error("Error reading first scanner data:", scanError);
        await handleError(scanError);
        continue;
      }

      if (scannerData !== "NG") {
        await writeBitsWithRest(1414, 6, 1, false);
        logger.info("First scan data is OK, stopping machine");
        continue;
      }

      await writeBitsWithRest(1414, 7, 1, false);
      const { text, serialNo } = barcodeGenerator.generateBarcodeData();
      await writeOCRDataToFile(text);
      logger.info("First scan data is NG, transferred to text file");
      await writeBitsWithRest(1410, 11, 1, false);

      // if (await checkResetOrBit(1600, 0, 1)) {
      //   logger.info("Reset detected after first scan, restarting cycle");
      //   continue;
      // }

      await writeBitsWithRest(1415, 4, 1, false);
      logger.info("File transfer confirmation sent to PLC");

      if (await checkResetOrBit(1410, 2, 1)) {
        logger.info(
          "Reset detected while waiting for 1410.2, restarting cycle"
        );
        continue;
      }

      logger.info("=== STARTING SECOND SCAN ===");
      await writeBitsWithRest(1414, 1, 1, false);
      logger.info("Triggered second scanner");

      let secondScannerData;
      try {
        secondScannerData = await comService.readDataSync();
        logger.info(`Second scan data: ${secondScannerData}`);
      } catch (scanError) {
        logger.error("Error reading second scanner data:", scanError);
        await handleError(scanError);
        continue;
      }

      if (await checkResetOrBit(1600, 0, 1)) {
        logger.info("Reset detected after second scan, restarting cycle");
        continue;
      }

      await writeBitsWithRest(
        1414,
        secondScannerData !== "NG" ? 6 : 7,
        1,
        false
      );
      logger.info(
        secondScannerData !== "NG" ? "Second scan OK" : "Second scan NG"
      );

      const isDataMatching =
        await compareScannerDataWithCode(secondScannerData);

      if (await checkResetOrBit(1600, 0, 1)) {
        logger.info("Reset detected after data comparison, restarting cycle");
        continue;
      }

      await writeBitsWithRest(1414, isDataMatching ? 3 : 4, 1, false);
      logger.info(isDataMatching ? "Data matches" : "Data does not match");

      await saveToMongoDB({
        io,
        serialNumber: serialNo,
        markingData: text,
        scannerData: secondScannerData,
        result: isDataMatching,
      });
      logger.info("Data saved to MongoDB");

      if (await checkResetOrBit(1410, 12, 1)) {
        logger.info("Reset detected at final step, restarting cycle");
        continue;
      }

      c++;
      await resetBits();
      logger.info(`Completed scan cycle ${c}`);
    } catch (error) {
      logger.error("Unexpected error in scanner workflow:", error);
      await handleError(error);
      await sleep(5000);
    }

    await sleep(100);
  }
}

// async function checkResetOrBit(register, bit, value) {
//   try {
//     const result = await waitForBitToBecomeOne(register, bit, value);
//     if (result === "reset") {
//       logger.info(
//         `Reset detected while waiting for ${register}.${bit}. Restarting cycle.`
//       );
//       await resetBits();
//       return true;
//     }
//     logger.info(`Received signal from PLC at ${register}.${bit}`);
//     return false;
//   } catch (error) {
//     logger.error(`Error in checkResetOrBit for ${register}.${bit}:`, error);
//     return true; // Treat errors as reset to safely restart the cycle
//   }
// }

async function checkReset() {
  return new Promise((resolve) => {
    const resetHandler = () => {
      resetEmitter.removeListener("reset", resetHandler);
      resolve(true);
    };
    resetEmitter.once("reset", resetHandler);
    setTimeout(() => {
      resetEmitter.removeListener("reset", resetHandler);
      resolve(false);
    }, 50);
  });
}

// async function handleError(error) {
//   console.log({ error });
//   try {
//     await writeBitsWithRest(1414, 12, 1, false); // Set error bit
//     // Implement any other error handling logic here
//   } catch (secondaryError) {
//     logger.error("Error during error handling:", secondaryError);
//   }
// }

// const resetBits = async () => {
//   try {
//     // await writeBitsWithRest(1414, 0, 0); // Reset bit 1414.0
//     await writeBitsWithRest(1414, 1, 0, false); // Reset bit 1414.1
//     await writeBitsWithRest(1414, 3, 0, false); // Reset bit 1414.3
//     await writeBitsWithRest(1414, 4, 0, false); // Reset bit 1414.4
//     await writeBitsWithRest(1414, 6, 0, false); // Reset bit 1414.6
//     await writeBitsWithRest(1414, 7, 0, false); // Reset bit 1414.7
//     await writeBitsWithRest(1414, 12, 0, false); // Reset bit 1414.12
//     logger.info("All bits reset to zero");
//   } catch (error) {
//     logger.error("Error resetting bits:", error);
//   }
// };

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT. Closing MongoDB connection and exiting...");
  await mongoDbService.disconnect();
  await resetBits();
  await comPort.closePort();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM. Closing MongoDB connection and exiting...");
  await mongoDbService.disconnect();
  await resetBits();
  await comPort.closePort();
  process.exit(0);
});
// runContinuousScan(null).then((o) => console.log({ o }));
