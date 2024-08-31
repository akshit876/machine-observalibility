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

// Function to convert a number to ASCII characters
function convertToASCII(number) {
  let asciiString = "";
  while (number > 0) {
    const asciiCode = number & 0xff; // Get the last byte
    asciiString = String.fromCharCode(asciiCode) + asciiString; // Convert to character and add to the beginning of the string
    number = number >> 8; // Shift to the next byte
  }
  return asciiString;
}

async function readRegister(address) {
  try {
    const { data } = await client.readHoldingRegisters(address, 1);
    const value = data[0];
    const asciiString = convertToASCII(value);
    console.log(
      `Read register at address ${address}: ${value} (ASCII: ${asciiString})`
    );
    return value;
  } catch (error) {
    console.error(`Error reading register at address ${address}:`, error);
    throw error;
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

// async function readRegister(address) {
//   try {
//     const { data } = await client.readHoldingRegisters(address, 1);
//     return data[0];
//   } catch (error) {
//     console.error(`Error reading register at address ${address}:`, error);
//     throw error;
//   }
// }

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
