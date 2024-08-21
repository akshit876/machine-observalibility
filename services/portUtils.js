import logger from "../logger.js";

// Handle the port open event
function handlePortOpen() {
  logger.info("Port is open and ready to read data");
}

// Handle the port close event
function handlePortClose() {
  logger.info("Serial port closed");
}

// Handle the port error event
function handlePortError(err) {
  logger.error("Error with serial port: %s", err.message);
}

// Handle other port events (e.g., disconnect, drain, flush)
function handlePortDisconnect() {
  logger.info("Port disconnected");
}

function handlePortDrain() {
  logger.info("Port drain event");
}

function handlePortFlush() {
  logger.info("Port flush event");
}

// Export the utility functions
export {
  handlePortOpen,
  handlePortClose,
  handlePortError,
  handlePortDisconnect,
  handlePortDrain,
  handlePortFlush,
};
