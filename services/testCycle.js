import { fileURLToPath } from "url";
import logger from "../logger.js";
import {
  readRegisterAndProvideASCII,
  writeBitsWithRest,
  //   writeBitsWithRestsWithRest,
} from "./modbus.js";
import { waitForBitToBecomeOne } from "./serialPortService.js";
import fs from "fs";
import path, { dirname } from "path";
import { getData } from "./lowDbService.js";
import { saveToCSVNew } from "./scanUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CODE_FILE_PATH = path.join(__dirname, "../data/code.txt");
async function writeOCRDataToFile(ocrDataString) {
  try {
    await clearCodeFile(); // Clear the file before writing new data
    fs.writeFileSync(CODE_FILE_PATH, ocrDataString, "utf8");
    logger.info("OCR data written to code.txt");
  } catch (error) {
    logger.error(`Error writing OCR data to file: ${error.message}`);
    throw error;
  }
}
/**
 * Checks if the grading is valid based on the last character of the scanner result.
 * Determines the validity dynamically using the data from LowDB.
 * @param {string} scannerResult - The scanner result string.
 * @returns {boolean} - True if the grade is allowed, otherwise false.
 */
async function checkGrading(scannerResult) {
  // Get the last character from the scanner result and convert to uppercase
  const lastChar = scannerResult.slice(-1).toUpperCase();

  // Retrieve grading information from LowDB
  const gradeData = await getData("grades"); // Assume 'grades' is the key storing grade rules in LowDB

  if (!gradeData || !gradeData[lastChar]) {
    // Return false if no grading data is found or if the grade is not valid
    console.error(`No grading data found for character: ${lastChar}`);
    return false;
  }

  // If there are allowed grades for the last character, return true
  return gradeData[lastChar].length > 0;
}

/**
 * Clears the contents of 'code.txt'.
 */
async function clearCodeFile() {
  try {
    fs.writeFileSync(CODE_FILE_PATH, "", "utf8"); // Overwrite with an empty string
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
async function runContinuousScan() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      console.log({ c });
      //   await writeBitsWithRest(1415, 2, 0);
      //   await writeBitsWithRest(1415, 2, 1);
      if (c > 0) await waitForBitToBecomeOne(1415, 7);
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      await writeBitsWithRest(1415, 9, 1);
      // **Cycle Start**: Wait until bit 0 of register 1400 is 1
      await waitForBitToBecomeOne(1400, 0);
      logger.info("Bit 0 of register 1400 is now 1, proceeding with scan.");

      // **Read data from scanner 1470 (20 bits)**
      const scannerData = await readRegisterAndProvideASCII(1470, 20);
      //   const scannerDataString = String.fromCharCode(...scannerData);
      logger.info(`Scanner data from register 1470: ${scannerData}`);
      console.log({ scannerData, l: scannerData.length });
      //   return;

      // **Check if scanner data is valid**
      if (scannerData !== "NG") {
        // **Write to PLC 1414, bit 13 to stop the machine from proceeding**
        await writeBitsWithRest(1414, 13, 1);
        logger.info("Machine stopped from proceeding, scanner data is OK.");
      } else {
        // **Write to PLC 1414, bit 14 to notify NG condition**
        await writeBitsWithRest(1414, 14, 1);
        logger.info("Scanner data is NG, notifying PLC.");
      }

      // **OCR Read**: Wait until bit 1 of register 1410 is 1
      await waitForBitToBecomeOne(1410, 1);

      // **Read OCR data from register 1450 (20 bits)**
      const ocrData = await readRegisterAndProvideASCII(1450, 20);
      //   const ocrDataString = String.fromCharCode(...ocrData);
      logger.info(`OCR data from register 1450: ${ocrData}`);

      // **Write to PLC that OCR read is done for the first time (1414, bit 15)**
      await writeBitsWithRest(1414, 15, 1);
      logger.info("OCR read completed for the first time, updated PLC.");

      // **Directly send OCR data into code.txt**
      await writeOCRDataToFile(ocrData);
      //   await clearCodeFile("code.txt");
      //   fs.writeFileSync(path.join(__dirname, "../data/code.txt"), finalCode);

      // **Wait until bit 2 of register 1410 is 1 to send data to laser**
      await waitForBitToBecomeOne(1410, 2);
      logger.info(
        "Bit 2 of register 1410 is now 1, proceeding to send data to laser."
      );

      // **Send data to laser from code.txt**
      //   await sendDataToLaserFromCodeFile();
      logger.info("Sent data to laser as per command.");

      // **Write confirmation to PLC (1415, bit 1)**
      await writeBitsWithRest(1415, 1, 1);
      logger.info("Confirmation written to PLC for laser data transmission.");

      // **3rd Cycle Scanning**
      logger.info("Starting 3rd cycle scanning...");

      // **Wait until bit 3 of register 1410 is 1 to begin reading data from scanner**
      await waitForBitToBecomeOne(1410, 3);
      logger.info(
        "Bit 3 of register 1410 is now 1, proceeding with 3rd cycle scanner read."
      );

      // **Read scanner data 1470 (20 bits)**
      const scannerData3rdCycle = await readRegisterAndProvideASCII(1470, 20);
      //   const scannerData3rdCycleString = String.fromCharCode(
      //     ...scannerData3rdCycle
      //   );
      logger.info(
        `Scanner data for 3rd cycle from register 1470: ${scannerData3rdCycle}`
      );

      //   **Compare scanner data with code.txt**
      const isDataMatching =
        await compareScannerDataWithCode(scannerData3rdCycle);

      // **Grading Check After Comparison**
      const isGradingValid = await checkGrading(scannerData3rdCycle);

      logger.info(`Grading Result: ${isGradingValid}`);

      // **Write to PLC based on matching result**
      if (isDataMatching && isGradingValid) {
        // Save results to CSV
        await saveToCSVNew(
          io,
          c + 1,
          scannerData3rdCycle,
          ocrData,
          scannerData3rdCycle.slice(-1).toUpperCase(),
          "OK"
        );
        await writeBitsWithRest(1414, 11, 1, 2000); // **OK -> Write to PLC**
        logger.info("Scanner data matches code.txt, OK signal written to PLC.");
      } else {
        await saveToCSVNew(
          io,
          c + 1,
          scannerData3rdCycle,
          ocrData,
          scannerData3rdCycle.slice(-1).toUpperCase(),
          "NG"
        );
        await writeBitsWithRest(1414, 12, 1); // **NG -> Write to PLC**
        logger.info(
          "Scanner data does not match code.txt, NG signal written to PLC."
        );
      }

      logger.info("3rd cycle scanning completed");

      // Optional: Add a small delay between cycles if needed
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      c++;
    } catch (error) {
      logger.error("Error during scan cycle:", error);
    }
  }
}
runContinuousScan();
