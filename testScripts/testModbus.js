import {
  connect,
  monitorRegisters,
  readRegister,
  writeRegister,
} from "../services/modbus.js";

async function testModbusService() {
  try {
    // Connect to the Modbus device
    await connect();

    // Read a register
    console.log("Reading register at address 0...");
    const value = await readRegister(0);
    console.log("Value at register 0:", value);

    // Write to a register
    console.log("Writing value 42 to register at address 1...");
    await writeRegister(1, 42);

    // Monitor registers for changes
    console.log("Monitoring registers 0-4 for changes...");
    monitorRegisters(0, 5);

    // The script will continue running and monitoring registers
    // You can manually stop it with Ctrl+C
  } catch (error) {
    console.error("Error in test script:", error);
  }
}

testModbusService();
