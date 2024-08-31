import { createServer } from "http";
import next from "next";
import fs from "fs";
import morgan from "morgan";
import { Server } from "socket.io";
import logger from "./logger.js"; // Assuming you have a logger setup
import { initSerialPort, watchCodeFile } from "./services/serialPortService.js";
import { MockSerialPort } from "./services/mockSerialPort.js"; // Import MockSerialPort

import { fileURLToPath } from "url";
import path, { dirname, parse } from "path";
import { getCurrentDate } from "./services/scanUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Apply morgan logging here
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
      handle(req, res); // Continue to the next handler
    });
  });

  const io = new Server(server);

  io.on("connection", (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // Handle CSV data request from the client
    socket.on("request-csv-data", () => {
      sendCsvDataToClient(socket);
    });

    // Handle Modbus data request from the client
    socket.on("request-modbus-data", ({ readRange }) => {
      sendModbusDataToClient(socket, readRange);
    });

    // Handle writing to Modbus register
    socket.on("write-modbus-register", ({ index, value }) => {
      writeModbusRegister(index, value);
      // After writing, update all clients with new data
      broadcastModbusData();
    });
  });

  // Start the server and listen on a port
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) {
      logger.error("Server failed to start: %s", err.message);
      throw err;
    }
    logger.info(`> Server ready on http://localhost:${PORT}`);

    // Initialize the serial port service
    initSerialPort(io); // Pass MockSerialPort to initSerialPort if needed

    // Start monitoring the code file for changes
    watchCodeFile();
  });

  // Handle server errors
  server.on("error", (err) => {
    logger.error("Server error: %s", err.message);
  });

  // Handle server close event
  server.on("close", () => {
    logger.info("Server closed");
  });

  // function sendCsvDataToClient(socket) {
  //   // const currentDate = new Date().toISOString().split("T")[0]; // Get current date in YYYY-MM-DD format
  //   // const filePath = path.join(__dirname, `../data/${currentDate}.csv`);

  //   const fileName = `${getCurrentDate()}.csv`;
  //   const filePath = path.join(__dirname, "data", fileName);

  //   console.log({ fileName });

  //   try {
  //     fs.accessSync(filePath, fs.constants.R_OK);
  //     console.log("File is accessible");
  //   } catch (err) {
  //     console.error("File is not accessible:", err);
  //   }

  //   // console.log({ filePath });
  //   if (fs.existsSync(filePath)) {
  //     fs.readFile(filePath, "utf8", (err, data) => {
  //       if (err) {
  //         logger.error("Error reading CSV file: ", err.message);
  //         return;
  //       }

  //       // Split the data by line breaks to get each row
  //       const rows = data.trim().split("\n");

  //       // Split each row by commas to get the individual cells, and remove double quotes
  //       const csvData = rows.map((row) =>
  //         row.split(",").map((cell) => cell.replace(/"/g, ""))
  //       );

  //       csvData.reverse(); // Reverse the order to have the latest timestamps first

  //       socket.emit("csv-data", {
  //         csvData,
  //       });
  //       logger.info(`Emitted current date CSV data to client: ${socket.id}`);
  //     });
  //   } else {
  //     logger.info(`No CSV file found for ${fileName}.`);
  //   }
  // }

  // New function to send Modbus data to client
  function sendModbusDataToClient(socket, readRange) {
    const [start, end] = readRange;
    // This is where you'd fetch the current state of Modbus registers
    // For now, we'll send dummy data based on the range
    const dummyData = {
      readRegisters: Array(end - start + 1)
        .fill(0)
        .map((_, i) => (start + i) * 100),
    };
    socket.emit("modbus-data", dummyData);
  }

  // New function to handle writing to Modbus register
  function writeModbusRegister(index, value) {
    logger.info(`Writing value ${value} to Modbus register ${index}`);
    // Here you would implement the actual writing to the Modbus register
    // For now, we'll just log the action
  }

  // New function to broadcast Modbus data to all clients
  function broadcastModbusData() {
    // This function would read the current state of all Modbus registers
    // and broadcast it to all connected clients
    const dummyData = {
      readRegisters: Array(10)
        .fill(0)
        .map((_, i) => i * 100),
    };
    io.emit("modbus-data", dummyData);
  }

  // Function to periodically update Modbus data (if needed)
  function updateModbusData() {
    broadcastModbusData();
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
      return; // Exit the function if the file is not accessible
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
