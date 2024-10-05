import { fileURLToPath } from "url";
import logger from "../logger.js";
import { writeBitsWithRest } from "./modbus.js";
import { waitForBitToBecomeOne } from "./serialPortService.js";

import { format } from "date-fns";
import fs from "fs";
import path, { dirname } from "path";
import ComPortService from "./ComPortService.js";
import ShiftUtility from "./ShiftUtility.js";
import BarcodeGenerator from "./barcodeGenrator.js";
import mongoDbService from "./mongoDbService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const comPort = new ComPortService();

async function saveToMongoDB(io, serialNumber, scannerData) {
  const now = new Date();
  const timestamp = format(now, "yyyy-MM-dd HH:mm:ss");

  const data = {
    Timestamp: new Date(timestamp),
    SerialNumber: serialNumber,
    ScannerData: scannerData,
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
barcodeGenerator.setResetTime(6, 0);

// // Generate barcode data for current date and time
// console.log(barcodeGenerator.generateBarcodeData());
export async function runContinuousScan(io = null) {
  // eslint-disable-next-line no-constant-condition

  while (true) {
    try {
      await mongoDbService.connect("main-data", "records");
      await comPort.initSerialPort();
      logger.info("Starting scanner workflow");

      // 1. Start
      await writeBitsWithRest(1410, 0, 1);

      // 2-3. Read scanner data from s/w
      const scannerData = await comPort.readData();
      logger.info(`Scanner data: ${scannerData}`);

      // 4-5. Check if data is OK or NG
      if (scannerData !== "NG") {
        await writeBitsWithRest(1410, 3, 1); // Signal  to PLC
        logger.info("Scanner data is found, stopping machine");
        return; // Exit the function if NG
      } else {
        await writeBitsWithRest(1410, 4, 1); // Signal  to PLC
        const { text, serialNo } = barcodeGenerator.generateBarcodeData();
        await writeOCRDataToFile(text);
        logger.info("Scanner data is NG, transferred to text file");
        await writeBitsWithRest(1410, 11, 1); // Signal  to PLC

        // 6. File transferred confirmation bit to be sent to PLC
        await writeBitsWithRest(1414, 0, 1);
        logger.info("File transfer confirmation sent to PLC");

        // 7. Get signal from PLC at 1414.2
        await waitForBitToBecomeOne(1414, 2, 1);
        logger.info("Received signal from PLC at 1414.2");

        // 8. Trigger scanner on bit now to PLC
        await writeBitsWithRest(1414, 1, 1);
        logger.info("Triggered scanner bit to PLC");

        // 9. Read scanner data now
        const secondScannerData = await comPort.readData();
        logger.info(`Second scanner data: ${secondScannerData}`);

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
        await saveToMongoDB(io, serialNo, secondScannerData);
        logger.info("Scanner workflow completed");

        // Optional: Add a small delay between cycles if needed
        await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
        c++;
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
// runContinuousScan().catch((error) => {
//   logger.error("Failed to start continuous scan:", error);
//   process.exit(1);
// });

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT. Closing MongoDB connection and exiting...");
  await mongoDbService.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM. Closing MongoDB connection and exiting...");
  await mongoDbService.disconnect();
  process.exit(0);
});
// runContinuousScan(null).then((o) => console.log({ o }));
