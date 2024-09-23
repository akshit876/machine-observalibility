import ModbusRTU from "modbus-serial";
import logger from "../logger.js";
import { emitErrorEvent } from "./utils.js";

// Default values
const DEFAULT_MODBUS_IP = "192.168.3.145";
const DEFAULT_MODBUS_PORT = 502;

const MODBUS_IP = process.env.NEXT_PUBLIC_MODBUS_IP || DEFAULT_MODBUS_IP;
const MODBUS_PORT =
  parseInt(process.env.NEXT_PUBLIC_MODBUS_PORT, 10) || DEFAULT_MODBUS_PORT;

class ModbusConnection {
  constructor() {
    this.client = new ModbusRTU();
    this.isConnected = false;
    this.reconnectInterval = 5000; // 5 seconds
    this.socket = null;
  }

  async connect() {
    if (this.isConnected) return;

    try {
      await this.client.connectTCP(MODBUS_IP, { port: MODBUS_PORT });
      this.client.setID(1); // Set the Modbus slave ID (adjust as needed)
      this.isConnected = true;
      logger.info(`Connected to Modbus device at ${MODBUS_IP}:${MODBUS_PORT}`);
    } catch (error) {
      console.log("connect", { error });
      emitErrorEvent(
        this.socket,
        "MODBUS_CONNECT_ERROR",
        `Error connecting to Modbus device: ${error.message}`
      );
      // this.scheduleReconnect();
    }
  }

  handleDisconnect() {
    logger.warn("Modbus connection closed. Attempting to reconnect...");
    this.isConnected = false;
    // this.scheduleReconnect();
  }

  scheduleReconnect() {
    setTimeout(() => this.connect(), this.reconnectInterval);
  }

  async ensureConnection() {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async readRegister(address, len) {
    await this.ensureConnection();
    try {
      const { data } = await this.client.readHoldingRegisters(address, len);
      logger.info(
        `Read registers starting at address ${address} (length: ${len}): ${data}`
      );
      return data;
    } catch (error) {
      emitErrorEvent(
        this.socket,
        "MODBUS_READ_ERROR",
        `Error reading registers at address ${address}: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  convertToASCII(registerValues) {
    let asciiString = "";
    registerValues.forEach((value) => {
      const lowByte = value & 0xff;
      const highByte = (value >> 8) & 0xff;
      asciiString +=
        String.fromCharCode(lowByte) + String.fromCharCode(highByte);
    });
    return asciiString;
  }

  async writeBitWithReset(address, bitPosition, value, delay = 200) {
    await this.ensureConnection();
    try {
      // Write the initial value to the bit
      await this.writeBit(address, bitPosition, value);
      logger.info(
        `Successfully wrote bit ${bitPosition} with value ${value} to register ${address}`
      );

      // Wait for the specified delay (default is 200ms)
      setTimeout(async () => {
        // Reset the bit to 0 after the delay
        await this.writeBit(address, bitPosition, false);
        logger.info(
          `Successfully reset bit ${bitPosition} to 0 after ${delay}ms in register ${address}`
        );
      }, delay);
    } catch (error) {
      console.error({ error });
      emitErrorEvent(
        this.socket,
        "MODBUS_WRITE_BIT_RESET_ERROR",
        `Error writing or resetting bit ${bitPosition} in register ${address}: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  async readRegisterAndProvideASCII(address, len) {
    try {
      const data = await this.readRegister(address, len);
      let asciiString = this.convertToASCII(data);
      // Remove trailing null characters (\x00) from the ASCII string
      // asciiString = asciiString.replace(/\x00+$/, "");
      asciiString = asciiString.replace(/\x00/g, " ").trim();
      console.log({ asciiString });
      console.log(
        `Read registers starting at address ${address} (length: ${len}): ${data} (ASCII: ${asciiString})`
      );
      return asciiString;
    } catch (error) {
      emitErrorEvent(
        this.socket,
        "MODBUS_READ_ASCII_ERROR",
        `Error reading registers at address ${address}: ${error.message}`
      );
      throw error;
    }
  }

  async writeRegister(address, value) {
    await this.ensureConnection();
    try {
      await this.client.writeRegister(address, value);
      logger.info(
        `Successfully wrote value ${value} to register at address ${address}`
      );
    } catch (error) {
      emitErrorEvent(
        this.socket,
        "MODBUS_WRITE_ERROR",
        `Error writing to register at address ${address}: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  async readBit(address, bitPosition) {
    await this.ensureConnection();
    try {
      const result = await this.client.readHoldingRegisters(address, 1);
      const registerValue = result.data[0];
      const bitValue = (registerValue & (1 << bitPosition)) !== 0;
      logger.info(
        `Read bit ${bitPosition} from register ${address}: ${bitValue}`
      );
      return bitValue;
    } catch (error) {
      emitErrorEvent(
        this.socket,
        "MODBUS_READ_BIT_ERROR",
        `Error reading bit ${bitPosition} from register ${address}: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  async readBits(address, bitPositions) {
    await this.ensureConnection();
    try {
      const result = await this.client.readHoldingRegisters(address, 1);
      const registerValue = result.data[0];

      const bitValues = bitPositions.map((bitPosition) => {
        const bitValue = (registerValue & (1 << bitPosition)) !== 0;
        return { position: bitPosition, value: bitValue };
      });

      logger.info(
        `Read bits ${bitPositions.join(", ")} from register ${address}: ${JSON.stringify(bitValues)}`
      );
      return bitValues;
    } catch (error) {
      emitErrorEvent(
        this.socket,
        "MODBUS_READ_BITS_ERROR",
        `Error reading bits ${bitPositions.join(", ")} from register ${address}: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  async writeBit(address, bitPosition, value) {
    await this.ensureConnection();
    try {
      const result = await this.client.readHoldingRegisters(address, 1);
      const currentValue = result.data[0];
      const newValue = value
        ? currentValue | (1 << bitPosition)
        : currentValue & ~(1 << bitPosition);
      await this.client.writeRegister(address, newValue);
      logger.info(
        `Successfully wrote bit ${bitPosition} with value ${value} to register ${address}`
      );
    } catch (error) {
      console.log({ error });
      emitErrorEvent(
        this.socket,
        "MODBUS_WRITE_BIT_ERROR",
        `Error writing bit ${bitPosition} to register ${address}: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  async writeBits(address, bitValues) {
    await this.ensureConnection();
    try {
      const result = await this.client.readHoldingRegisters(address, 1);
      let currentValue = result.data[0];

      for (const { position, value } of bitValues) {
        if (position < 0 || position > 15) {
          throw new Error(
            `Invalid bit position: ${position}. Must be between 0 and 15.`
          );
        }
        currentValue = value
          ? currentValue | (1 << position)
          : currentValue & ~(1 << position);
      }

      await this.client.writeRegister(address, currentValue);
      logger.info(
        `Successfully wrote bits to register ${address}: ${JSON.stringify(bitValues)}`
      );
    } catch (error) {
      emitErrorEvent(
        this.socket,
        "MODBUS_WRITE_BITS_ERROR",
        `Error writing bits to register ${address}: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  async readDataAndConfirm(
    address,
    len,
    inputFeedbackBit,
    outputFeedbackBit,
    delay
  ) {
    await this.ensureConnection();

    try {
      const inputFeedback = await this.readBit(address, inputFeedbackBit);
      if (!inputFeedback) {
        logger.info(
          `Input feedback bit ${inputFeedbackBit} is not set. Aborting read.`
        );
        return null;
      }

      const asciiString = await this.readRegisterAndProvideASCII(address, len);
      logger.info(
        `Read data from address ${address} and converted to ASCII: ${asciiString}`
      );

      await this.writeBit(address, outputFeedbackBit, true);
      logger.info(
        `Set output feedback bit ${outputFeedbackBit} to confirm read success.`
      );

      setTimeout(async () => {
        await this.writeBit(address, outputFeedbackBit, false);
        logger.info(`Reset output feedback bit ${outputFeedbackBit}.`);
      }, delay);

      return asciiString;
    } catch (error) {
      emitErrorEvent(
        this.socket,
        "MODBUS_READ_CONFIRM_ERROR",
        `Error in readDataAndConfirm: ${error.message}`
      );
      this.handleError(error);
      throw error;
    }
  }

  handleError(error) {
    if (error.errno === "ETIMEDOUT" || error.errno === "ECONNRESET") {
      logger.warn(`Connection error: ${error.errno}. Scheduling reconnect.`);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }
}

const modbusConnection = new ModbusConnection();

export const setSocket = (socket) => {
  modbusConnection.socket = socket;
};

export const connect = () => modbusConnection.connect();
export const readRegister = (address, len) =>
  modbusConnection.readRegister(address, len);
export const writeRegister = (address, value) =>
  modbusConnection.writeRegister(address, value);
export const readRegisterAndProvideASCII = (address, len) =>
  modbusConnection.readRegisterAndProvideASCII(address, len);
export const readBit = (address, bitPosition) =>
  modbusConnection.readBit(address, bitPosition);
export const writeBit = (address, bitPosition, value) =>
  modbusConnection.writeBit(address, bitPosition, value);
export const readBits = (address, bitPositions) =>
  modbusConnection.readBits(address, bitPositions);
export const writeBits = (address, bitValues) =>
  modbusConnection.writeBits(address, bitValues);
export const writeBitsWithRest = (address, bitPosition, value, delay) =>
  modbusConnection.writeBitWithReset(address, bitPosition, value, delay);
export const readDataAndConfirm = (
  address,
  len,
  inputFeedbackBit,
  outputFeedbackBit,
  delay
) =>
  modbusConnection.readDataAndConfirm(
    address,
    len,
    inputFeedbackBit,
    outputFeedbackBit,
    delay
  );

// writeBitsWithRest(1415, 9, 1, 2000);
