import {
  connect,
  // monitorRegisters,
  readRegister,
  readRegisterAndProvideASCII,
  writeRegister,
  readBit,
  writeBit,
  readBits,
} from "../services/modbus.js";

async function testModbusService() {
  try {
    // Connect to the Modbus device
    await connect();

    // Read a register
    // console.log("Reading register at address 0...");
    // const value = await readRegister(300, 1);
    // console.log("Value at register 300:", value);

    // const asciiString = readRegisterAndProvideASCII(350, 10);
    // console.log("ASCII String at register 350:", asciiString);

    // Test reading and writing individual bits
    let testBitRegister = 300;
    const testBits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // Test bits at positions 0, 2, 5, and 15
    const value = await readBits(testBitRegister, testBits.reverse());
    const p2 = value.map((p, i) => Number(p.value));
    console.log(p2);

    // for (const bit of testBits) {
    //   const value = await readBit(testBitRegister, bit);
    //   console.log(`Bit ${bit}: ${value}`);
    // }
    // console.log(`\nTesting bit operations on register ${testBitRegister}`);

    // // Write 0 to all bits in the register
    // await writeRegister(testBitRegister, 0);

    // // Read initial bit values
    // console.log("Initial bit values:");
    // for (const bit of testBits) {
    //   const value = await readBit(testBitRegister, bit);
    //   console.log(`Bit ${bit}: ${value}`);
    // }

    // // Set each test bit to 1
    testBitRegister = 323;
    console.log("\nSetting test bits to 1");
    for (const bit of testBits) {
      await writeBit(testBitRegister, bit, true);
      const value = await readBit(testBitRegister, bit);
      console.log(`Bit ${bit} set to: ${value}`);
    }

    // // Read the full register value
    // const [fullValue] = await readRegister(testBitRegister, 1);
    // console.log(`\nFull register value after setting bits: ${fullValue}`);

    // // Clear each test bit
    // console.log("\nClearing test bits");
    // for (const bit of testBits) {
    //   await writeBit(testBitRegister, bit, false);
    //   const value = await readBit(testBitRegister, bit);
    //   console.log(`Bit ${bit} cleared to: ${value}`);
    // }

    // // Read the full register value again
    // const [finalValue] = await readRegister(testBitRegister, 1);
    // console.log(`\nFinal register value after clearing bits: ${finalValue}`);

    // if (finalValue === 0) {
    //   console.log("Bit read/write test passed");
    // } else {
    //   console.log("Bit read/write test failed");
    // }

    // Write to a register
    // console.log("Writing value 42 to register at address 1...");
    // await writeRegister(1, 42);

    // Monitor registers for changes
    // console.log("Monitoring registers 0-4 for changes...");
    // monitorRegisters(0, 5);

    // The script will continue running and monitoring registers
    // You can manually stop it with Ctrl+C
  } catch (error) {
    console.error("Error in test script:", error);
  }
}

testModbusService();
