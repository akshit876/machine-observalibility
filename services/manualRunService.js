import { writeBit } from "./modbus.js";
import logger from "../logger.js";
import { emitErrorEvent } from "./utils.js";
// import { emitErrorEvent } from "../utils/errorHandler.js"; // Import the error utility

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

export async function manualRun(operation, socket) {
  if (!MANUAL_RUN_ADDRESSES[operation]) {
    const errorMessage = `Invalid operation: ${operation}`;
    emitErrorEvent(socket, "INVALID_MANUAL_RUN_OPERATION", errorMessage);
    throw new Error(errorMessage);
  }

  const { address, bit } = MANUAL_RUN_ADDRESSES[operation];

  try {
    await writeBit(address, bit, 1);
    logger.info(`Manual run operation executed: ${operation}`);

    // Reset the bit after resetTime
    setTimeout(async () => {
      try {
        await writeBit(address, bit, 0);
        logger.info(`Manual run operation reset: ${operation}`);
      } catch (resetError) {
        const errorMessage = `Error resetting manual run operation ${operation}: ${resetError.message}`;
        emitErrorEvent(socket, "MANUAL_RUN_RESET_ERROR", errorMessage);
        logger.error(errorMessage);
      }
    }, resetTime);

    return {
      success: true,
      message: `Operation ${operation} executed successfully`,
    };
  } catch (error) {
    const errorMessage = `Error executing manual run operation ${operation}: ${error.message}`;
    emitErrorEvent(socket, "MANUAL_RUN_EXECUTION_ERROR", errorMessage);
    logger.error(errorMessage);
    throw error;
  }
}
