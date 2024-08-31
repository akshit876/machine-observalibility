import { createServer } from "http";
import next from "next";
import fs from "fs";
import morgan from "morgan";
import { Server } from "socket.io";
import logger from "./logger.js";
import { initSerialPort, watchCodeFile } from "./services/serialPortService.js";
import { MockSerialPort } from "./services/mockSerialPort.js";
import { fileURLToPath } from "url";
import path, { dirname, parse } from "path";
import { getCurrentDate } from "./services/scanUtils.js";
import { connect, readRegister, writeRegister } from "./services/modbus.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })(req, res, (err) => {
      if (err) {
        res.statusCode = 500;
        res.end("Internal Server Error");
        return;
      }
      handle(req, res);
    });
  });

  const io = new Server(server);

  io.on("connection", (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    socket.on("request-csv-data", () => {
      sendCsvDataToClient(socket);
    });

    socket.on("request-modbus-data", async ({ readRange }) => {
      await sendModbusDataToClient(socket, readRange);
    });

    socket.on("write-modbus-register", async ({ address, value }) => {
      try {
        await writeModbusRegister(address, value);
        logger.info(
          `Client ${socket.id} wrote value ${value} to register ${address}`
        );
        socket.emit("writeSuccess", { address, value });
      } catch (error) {
        logger.error(
          `Error writing to register for client ${socket.id}:`,
          error
        );
        socket.emit("error", {
          message: "Failed to write to register",
          details: error.message,
        });
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async (err) => {
    if (err) {
      logger.error("Server failed to start: %s", err.message);
      throw err;
    }
    logger.info(`> Server ready on http://localhost:${PORT}`);

    initSerialPort(io);
    watchCodeFile();

    // Initialize Modbus connection once
    try {
      await connect();
      logger.info("Modbus connection initialized");
    } catch (error) {
      logger.error("Failed to initialize Modbus connection:", error);
    }
  });

  server.on("error", (err) => {
    logger.error("Server error: %s", err.message);
  });

  server.on("close", () => {
    logger.info("Server closed");
  });

  async function sendModbusDataToClient(socket, readRange) {
    try {
      const [start, length] = readRange;
      logger.info(
        `Client ${socket.id} requested read: start=${start}, length=${length}`
      );

      const registers = await readRegister(start, length);

      logger.info(
        `Read successful for client ${socket.id}: ${JSON.stringify(registers)}`
      );
      socket.emit("modbus-data", { registers });
    } catch (error) {
      logger.error(`Error reading registers for client ${socket.id}:`, error);
      socket.emit("error", {
        message: "Failed to read registers",
        details: error.message,
      });
    }
  }

  async function writeModbusRegister(address, value) {
    await writeRegister(address, value);
  }

  // Set up periodic updates if needed
  // setInterval(updateModbusData, 1000); // Update every second

  function sendCsvDataToClient(socket) {
    const fileName = `${getCurrentDate()}.csv`;
    const filePath = path.join(__dirname, "data", fileName);

    console.log({ fileName });

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log("File is accessible");
    } catch (err) {
      console.error("File is not accessible:", err);
      return;
    }

    if (fs.existsSync(filePath)) {
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          logger.error("Error reading CSV file: ", err.message);
          return;
        }

        // Split the data by line breaks to get each row
        const rows = data.trim().split("\n");

        if (rows.length === 0) {
          logger.info("CSV file is empty.");
          return;
        }

        // Extract the header row
        const header = rows[0];

        // Extract and reverse the remaining rows
        const dataRows = rows
          .slice(1)
          .map((row) => row.split(",").map((cell) => cell.replace(/"/g, "")))
          .reverse(); // Reverse the order starting from the second row

        // Combine the header with the reversed data rows
        const csvData = [header.split(","), ...dataRows];

        socket.emit("csv-data", {
          csvData,
        });
        logger.info(`Emitted current date CSV data to client: ${socket.id}`);
      });
    } else {
      logger.info(`No CSV file found for ${fileName}.`);
    }
  }
});
