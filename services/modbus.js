import ModbusRTU from "modbus-serial";

const client = new ModbusRTU();

const MODBUS_IP = process.env.NEXT_PUBLIC_MODBUS_IP;
const MODBUS_PORT = parseInt(process.env.NEXT_PUBLIC_MODBUS_PORT, 10);

async function connect() {
  try {
    await client.connectTCP(MODBUS_IP, { port: MODBUS_PORT });
    client.setID(1); // Set the Modbus slave ID (adjust as needed)
    console.log(`Connected to Modbus device at ${MODBUS_IP}:${MODBUS_PORT}`);
  } catch (error) {
    console.error("Error connecting to Modbus device:", error);
    throw error; // Let the caller handle the error
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

// Function to convert an array of register values to ASCII characters with the correct byte order
function convertToASCII(registerValues) {
  let asciiString = "";
  registerValues.forEach((value) => {
    // Extract the two bytes from the 16-bit register
    const lowByte = value & 0xff; // Low byte (first)
    const highByte = (value >> 8) & 0xff; // High byte (second)

    // Convert bytes to characters and append to the final ASCII string
    asciiString += String.fromCharCode(lowByte) + String.fromCharCode(highByte);
  });
  return asciiString;
}

async function readRegisterAndProvideASCII(address, len) {
  try {
    const { data } = await client.readHoldingRegisters(address, len);
    const asciiString = convertToASCII(data);
    console.log(
      `Read registers starting at address ${address} (length: ${len}): ${data} (ASCII: ${asciiString})`
    );
    return asciiString;
  } catch (error) {
    console.error(`Error reading registers at address ${address}:`, error);
    throw error;
  }
}

// without ascii conversion
async function readRegister(address, len) {
  try {
    const { data } = await client.readHoldingRegisters(address, len);
    // const asciiString = convertToASCII(data);
    console.log(
      `Read registers starting at address ${address} (length: ${len}): ${data})`
    );
    return data;
  } catch (error) {
    console.error(`Error reading registers at address ${address}:`, error);
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

export {
  connect,
  monitorRegisters,
  readRegister,
  writeRegister,
  readRegisterAndProvideASCII,
};
