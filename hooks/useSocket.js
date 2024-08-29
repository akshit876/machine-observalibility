import { useState, useEffect } from "react";
import io from "socket.io-client";

// Custom hook to manage CSV data
export const useCsvData = () => {
  const [csvData, setCsvData] = useState([]);
  const socket = io.connect("http://localhost:3000"); // Adjust the URL as needed

  useEffect(() => {
    // Function to handle incoming CSV data
    const handleCsvData = (data) => {
      setCsvData(data.csvData);
    };

    // Request CSV data on component mount
    socket.emit("request-csv-data");

    // Listen for the csv-data event from the server
    socket.on("csv-data", handleCsvData);

    // Cleanup the event listener on component unmount
    return () => {
      socket.off("csv-data", handleCsvData);
      socket.disconnect(); // Close the socket connection when the component unmounts
    };
  }, [socket]);

  return csvData;
};
