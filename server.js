import { createServer } from "http";
import next from "next";
import morgan from "morgan";
import logger from "./logger.js"; // Assuming you have a logger setup
import { initSerialPort, watchCodeFile } from "./services/serialPortService.js";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Middleware for logging HTTP requests
  server.on(
    "request",
    morgan("combined", {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );

  // Start the server and listen on a port
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) {
      logger.error("Server failed to start: %s", err.message);
      throw err;
    }
    logger.info(`> Server ready on http://localhost:${PORT}`);

    // Initialize the serial port service
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const port = initSerialPort();

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
});
