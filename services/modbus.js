import ModbusRTU from "modbus-serial";

const client = new ModbusRTU();

async function connect() {
  try {
    await client.connectTCP("192.168.0.100", { port: 502 }); // Replace with your Modbus device's IP address and port
    client.setID(1); // Set the Modbus slave ID (adjust as needed)
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
      const { data: currentValues } = await client.readHoldingRegisters(
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
    const { data } = await client.readHoldingRegisters(address, 1);
    return data[0];
  } catch (error) {
    console.error(`Error reading register at address ${address}:`, error);
    throw error;
  }
}

async function writeRegister(address, value) {
  try {
    await client.writeRegister(address, value);
    console.log(
      `Successfully wrote value ${value} to register at address ${address}`
    );
  } catch (error) {
    console.error(`Error writing to register at address ${address}:`, error);
    throw error;
  }
}

export { connect, monitorRegisters, readRegister, writeRegister };
