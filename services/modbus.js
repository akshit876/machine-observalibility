const Modbus = require("modbus-serial");

const modbus = new Modbus();

async function connect() {
  try {
    await modbus.connect({
      port: "192.168.0.100", // Replace with your Modbus device's IP address
      baudrate: 9600,
      parity: "none",
      stopBits: 1,
      dataBits: 8,
    });

    console.log("Connected to Modbus device");
  } catch (error) {
    console.error("Error connecting to Modbus device:", error);
    process.exit(1); // Exit the process if connection fails
  }
}

async function monitorRegisters(startAddress, quantity) {
  try {
    let previousValues = [];

    while (true) {
      const currentValues = await modbus.readHoldingRegisters(
        startAddress,
        quantity
      );

      if (
        currentValues.some((value, index) => value !== previousValues[index])
      ) {
        console.log("Data change detected:", currentValues);
        previousValues = currentValues;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Adjust polling interval as needed
    }
  } catch (error) {
    console.error("Error monitoring registers:", error);
    // Handle specific errors or retry
    if (error.code === "ETIMEDOUT") {
      console.warn("Connection timed out, retrying...");
      await connect(); // Reconnect if connection timed out
    } else {
      process.exit(1); // Exit the process if other errors occur
    }
  }
}

async function readRegister(address) {
  try {
    const result = await modbus.readHoldingRegisters(address, 1);
    return result.data[0];
  } catch (error) {
    console.error(`Error reading register at address ${address}:`, error);
    throw error;
  }
}

async function writeRegister(address, value) {
  try {
    await modbus.writeRegister(address, value);
    console.log(
      `Successfully wrote value ${value} to register at address ${address}`
    );
  } catch (error) {
    console.error(`Error writing to register at address ${address}:`, error);
    throw error;
  }
}

module.exports = { connect, monitorRegisters, readRegister, writeRegister };
