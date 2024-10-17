import BufferedComPortService from "./ComPortService.js";
import { writeBitsWithRest } from "./modbus.js";
import { sleep } from "./testCycle.js";

const comService = new BufferedComPortService({
  path: "COM3", // Make sure this matches your actual COM port
  baudRate: 9600, // Adjust if needed
  logDir: "com_port_logs", // Specify the directory for log files
});

async function runn() {
  try {
    console.log("Attempting to initialize serial port...");
    await comService.initSerialPort();
    console.log("Initialized serial port successfully");
  } catch (comError) {
    console.log("Failed to initialize serial port:", comError);
    console.log("Waiting 5 seconds before retrying serial port initialization");
    await sleep(5000);
    // continue;
  }
  while (1) {
    await writeBitsWithRest(1415, 0, 1, 100, false);
    await sleep(1000);
    console.log("=== STARTING FIRST SCAN ===");
    console.log(
      "-----------------------------------------------------------------------------------------------------------"
    );
    let scannerData;
    try {
      console.log("Attempting to read first scan data...");
      scannerData = await comService.redQ();
      console.log(`First scan data: ${scannerData}`);
    } catch (scanError) {
      console.error("Error reading first scanner data:", scanError);
      console.log("Calling handleError for first scan failure");
      // await handleError(scanError);
      // continue;
    }
    await sleep(10 * 1000);
    console.log(comService.qu);
  }
}

runn();
