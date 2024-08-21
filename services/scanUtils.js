import fs from "fs";
import path, { dirname } from "path";
import ExcelJS from "exceljs";
import logger from "../logger.js";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let buffer = ""; // Buffer to store incoming data

// Handle incoming data and update buffer
export function updateBuffer(data) {
  buffer += data.toString();
  return buffer.split(/(NG|\r)/);
}

// Process the first scan
export function processFirstScan(part) {
  logger.info("First scan data received: %s", part);
  buffer = ""; // Clear buffer after processing first scan
  return part; // Return the first scan data for later comparison
}

// Process the second scan
export async function processSecondScan(part, firstScanData) {
  const secondScanData = part;
  logger.info("Second scan data received: %s", secondScanData);

  const result = compareScans(firstScanData, secondScanData);
  const manualCode = await readFromFile("code.txt");
  await saveToExcel(manualCode, result);
  logger.info("Scan comparison result saved to Excel: %s", result);

  // Clear the code file and reset for the next operation
  await clearCodeFile("code.txt");
}

// Compare the two scans and return "OK" or "NG"
export function compareScans(scan1, scan2) {
  return scan1 === scan2 ? "OK" : "NG";
}

// Save the result to an Excel file
export async function saveToExcel(manualCode, result) {
  const fileName = `${getCurrentDate()}.xlsx`;
  const filePath = path.join(__dirname, "../data", fileName);

  const workbook = new ExcelJS.Workbook();
  let worksheet;

  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
    worksheet = workbook.getWorksheet(1);
  } else {
    worksheet = workbook.addWorksheet("Scan Results");
    worksheet.columns = [
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "Code", key: "code", width: 20 },
      { header: "Result", key: "result", width: 10 },
    ];
  }

  worksheet.addRow({
    timestamp: new Date().toISOString(),
    code: manualCode,
    result: result,
  });

  await workbook.xlsx.writeFile(filePath);
  logger.info("Data saved to Excel file: %s", fileName);
}

// Read the manual code from the file
export function readFromFile(fileName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "../data", fileName);
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        logger.error("Error reading from file: %s", err.message);
        return reject(err);
      }
      resolve(data.trim());
    });
  });
}

// Clear the code file after processing
export function clearCodeFile(fileName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "../data", fileName);
    fs.writeFile(filePath, "", (err) => {
      if (err) {
        logger.error("Error clearing code file: %s", err.message);
        return reject(err);
      }
      logger.info("Code file cleared");
      resolve();
    });
  });
}

// Function to get the current date as a string for the file name
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
