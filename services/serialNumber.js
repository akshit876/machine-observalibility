import { format, parse, isAfter, setHours, setMinutes } from "date-fns";
import MongoDBService from "./mongoDbService.js";
import logger from "../logger.js";

class SerialNumberGeneratorService {
  constructor() {
    this.currentSerialNumber = 1;
    this.lastResetDate = new Date();
    this.resetHour = 6; // Default reset time is 6:00 AM
    this.resetMinute = 0;
    this.isInitialized = false;
  }

  async initialize(dbName, collectionName) {
    if (this.isInitialized) {
      logger.info("SerialNumberGeneratorService already initialized");
      return;
    }

    try {
      await MongoDBService.connect(dbName, collectionName);
      const lastDocument = await this.getLastDocumentFromMongoDB();

      if (lastDocument) {
        this.currentSerialNumber = this.extractSerialNumberFromOCR(
          lastDocument.OCRData
        );
        logger.info(
          `Initialized serial number to ${this.currentSerialNumber} from last MongoDB document`
        );
      } else {
        this.currentSerialNumber = 1;
        logger.info(
          "No previous documents found, starting with serial number 0001"
        );
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error("Error initializing SerialNumberGeneratorService:", error);
      throw error;
    }
  }

  async getLastDocumentFromMongoDB() {
    try {
      const latestRecord = await MongoDBService.collection
        .find()
        .sort({ Timestamp: -1 })
        .limit(1)
        .toArray();

      return latestRecord[0] || null;
    } catch (error) {
      logger.error("Error fetching last document from MongoDB:", error);
      throw error;
    }
  }

  // ... rest of the methods remain the same
  extractSerialNumberFromOCR(ocrData) {
    // Assuming the serial number is a 4-digit number in the OCR data
    // Modify this regex if the format is different
    const match = ocrData.match(/\d{4}/);
    return match ? parseInt(match[0], 10) + 1 : 1; // Start from next number, or 1 if not found
  }

  setResetTime(hour, minute) {
    this.resetHour = hour;
    this.resetMinute = minute;
    logger.info(`Reset time set to ${hour}:${minute}`);
  }

  getNextSerialNumber() {
    this.checkAndResetSerialNumber();
    const serialNumber = this.currentSerialNumber.toString().padStart(4, "0");
    this.currentSerialNumber++;
    return serialNumber;
  }

  checkAndResetSerialNumber() {
    const now = new Date();
    const resetTime = setMinutes(
      setHours(now, this.resetHour),
      this.resetMinute
    );

    if (isAfter(now, this.lastResetDate) && isAfter(now, resetTime)) {
      this.currentSerialNumber = 1;
      this.lastResetDate = now;
      logger.info(
        `Serial number reset to 0001 at ${format(now, "yyyy-MM-dd HH:mm:ss")}`
      );
    }
  }
}

export default new SerialNumberGeneratorService();
