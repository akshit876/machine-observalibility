import { parentPort } from "worker_threads";
import logger from "../logger.js";
import { readBit } from "./modbus.js";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function monitorResetSignal() {
  logger.info("Reset signal monitor started and waiting for start signal");

  // Wait for start signal from main thread
  await new Promise((resolve) => {
    parentPort.once("message", (message) => {
      if (message === "start") {
        logger.info("Received start signal, beginning monitoring");
        resolve();
      }
    });
  });

  while (true) {
    try {
      console.log("here");
      const resetSignal = await readBit(1600, 0);
      if (resetSignal) {
        logger.info("Reset signal detected at 1600.0");
        parentPort.postMessage("reset");
        // Wait for the bit to be cleared
        while (await readBit(1600, 0)) {
          await sleep(100);
        }
        logger.info("Reset signal cleared");
      }
    } catch (error) {
      logger.error("Error in monitorResetSignal:", error);
      // Wait a bit before retrying to prevent tight error loops
      await sleep(1000);
    }
    await sleep(50); // Small delay between checks
  }
}

monitorResetSignal().catch((error) => {
  logger.error("Fatal error in monitorResetSignal:", error);
  process.exit(1);
});
