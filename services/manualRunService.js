import { writeBit } from "./modbus.js";
import logger from "../logger.js";

const resetTime = 200;

const MANUAL_RUN_ADDRESSES = {
  markingStart: { address: 1414, bit: 0 },
  scannerTrigger: { address: 1414, bit: 1 },
  ocrTrigger: { address: 1414, bit: 2 },
  workLight: { address: 1414, bit: 3 },
  servoHome: { address: 1414, bit: 4 },
  servoScannerPosition: { address: 1414, bit: 5 },
  servoOcrPosition: { address: 1414, bit: 6 },
  servoMarkingPosition: { address: 1414, bit: 7 },
};

export async function manualRun(operation) {
  if (!MANUAL_RUN_ADDRESSES[operation]) {
    throw new Error(`Invalid operation: ${operation}`);
  }

  const { address, bit } = MANUAL_RUN_ADDRESSES[operation];

  try {
    await writeBit(address, bit, 1);
    logger.info(`Manual run operation executed: ${operation}`);

    // Reset the bit after 1 second
    setTimeout(async () => {
      await writeBit(address, bit, 0);
      logger.info(`Manual run operation reset: ${operation}`);
    }, resetTime);

    return {
      success: true,
      message: `Operation ${operation} executed successfully`,
    };
  } catch (error) {
    logger.error(`Error executing manual run operation ${operation}:`, error);
    throw error;
  }
}
