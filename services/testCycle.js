import { fileURLToPath } from "url";
import logger from "../logger.js";
import { readBit, writeBitsWithRest } from "./modbus.js";
import { waitForBitToBecomeOne } from "./serialPortService.js";

import { format } from "date-fns";
import fs from "fs";
import path, { dirname } from "path";
import ComPortService from "./ComPortService.js";
import ShiftUtility from "./ShiftUtility.js";
import BarcodeGenerator from "./barcodeGenrator.js";
import mongoDbService from "./mongoDbService.js";
import BufferedComPortService from "./ComPortService.js";

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

export async function runContinuousScan(io = null, comService) {
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

        await writeBitsWithRest(1414, 0, 1);

        // logger.info("Received signal from PLC at 1410.2");
        c++;
        await resetBits();
      }
    } catch (error) {
      logger.error("Error in scanner workflow:", error);
      // Implement error handling, possibly signaling an error to the PLC
      await writeBitsWithRest(1414, 12, 1); // NG signal in case of error
    } finally {
      await comPort.closePort();
    }
  }
}

// code to test servce
// runContinuousScan(null,comService).catch((error) => {
//   logger.error("Failed to start continuous scan:", error);
//   process.exit(1);
// });

const resetBits = async () => {
  try {
    // await writeBitsWithRest(1414, 0, 0); // Reset bit 1414.0
    await writeBitsWithRest(1414, 1, 0, false); // Reset bit 1414.1
    await writeBitsWithRest(1414, 3, 0, false); // Reset bit 1414.3
    await writeBitsWithRest(1414, 4, 0, false); // Reset bit 1414.4
    await writeBitsWithRest(1414, 6, 0, false); // Reset bit 1414.6
    await writeBitsWithRest(1414, 7, 0, false); // Reset bit 1414.7
    await writeBitsWithRest(1414, 12, 0, false); // Reset bit 1414.12
    logger.info("All bits reset to zero");
  } catch (error) {
    logger.error("Error resetting bits:", error);
  }
};

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
