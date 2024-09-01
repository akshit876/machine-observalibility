import ModbusRTU from "modbus-serial";
import logger from "../logger.js";
// import logger from '../logger.js';  // Adjust the path as necessary

// Default values
const DEFAULT_MODBUS_IP = "192.168.3.145";
const DEFAULT_MODBUS_PORT = 502;

// const MODBUS_IP = process.env.NEXT_PUBLIC_MODBUS_IP;
// const MODBUS_PORT = parseInt(process.env.NEXT_PUBLIC_MODBUS_PORT, 10);

// Try to get values from env, use defaults if not available
const MODBUS_IP = process.env.NEXT_PUBLIC_MODBUS_IP || DEFAULT_MODBUS_IP;
const MODBUS_PORT =
  parseInt(process.env.NEXT_PUBLIC_MODBUS_PORT, 10) || DEFAULT_MODBUS_PORT;

class ModbusConnection {
  constructor() {
    this.client = new ModbusRTU();
    this.isConnected = false;
    this.reconnectInterval = 5000; // 5 seconds
  }

  async connect() {
    if (this.isConnected) return;

    try {
      await this.client.connectTCP(MODBUS_IP, { port: MODBUS_PORT });
      this.client.setID(1); // Set the Modbus slave ID (adjust as needed)
      this.isConnected = true;
      logger.info(`Connected to Modbus device at ${MODBUS_IP}:${MODBUS_PORT}`);

      // Set up connection monitoring
      // this.client.socket.on("close", this.handleDisconnect.bind(this));
    } catch (error) {
      logger.error("Error connecting to Modbus device:", error);
      this.scheduleReconnect();
    }
  }

  handleDisconnect() {
    logger.warn("Modbus connection closed. Attempting to reconnect...");
    this.isConnected = false;
    this.scheduleReconnect();
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
      logger.error(`Error reading registers at address ${address}:`, error);
      this.handleError(error);
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
      logger.error(`Error writing to register at address ${address}:`, error);
      this.handleError(error);
      throw error;
    }
  }

  async readBit(address, bitPosition) {
    await this.ensureConnection();
    try {
      const result = await this.client.readHoldingRegisters(address, 1);
      const registerValue = result.data[0]; // Access the first element of the data array
      const bitValue = (registerValue & (1 << bitPosition)) !== 0;
      logger.info(
        `Read bit ${bitPosition} from register ${address}: ${bitValue}`
      );
      return bitValue;
    } catch (error) {
      logger.error(
        `Error reading bit ${bitPosition} from register ${address}:`,
        error
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
      logger.error(
        `Error reading bits ${bitPositions.join(", ")} from register ${address}:`,
        error
      );
      this.handleError(error);
      throw error;
    }
  }

  async writeBit(address, bitPosition, value) {
    await this.ensureConnection();
    try {
      // Read the current register value
      const [currentValue] = await this.client.readHoldingRegisters(address, 1);

      // Modify the bit
      const newValue = value
        ? currentValue | (1 << bitPosition) // Set bit
        : currentValue & ~(1 << bitPosition); // Clear bit

      // Write the modified value back to the register
      await this.client.writeRegister(address, newValue);
      logger.info(
        `Successfully wrote bit ${bitPosition} with value ${value} to register ${address}`
      );
    } catch (error) {
      logger.error(
        `Error writing bit ${bitPosition} to register ${address}:`,
        error
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

export const connect = () => modbusConnection.connect();
export const readRegister = (address, len) =>
  modbusConnection.readRegister(address, len);
export const writeRegister = (address, value) =>
  modbusConnection.writeRegister(address, value);
export const readRegisterAndProvideASCII = async (address, len) => {
  const data = await modbusConnection.readRegister(address, len);
  return modbusConnection.convertToASCII(data);
};

export const readBit = (address, bitPosition) =>
  modbusConnection.readBit(address, bitPosition);
export const writeBit = (address, bitPosition, value) =>
  modbusConnection.writeBit(address, bitPosition, value);

// Initialize the connection when this module is imported
// connect();
