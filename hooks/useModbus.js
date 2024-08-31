/* eslint-disable consistent-return */
import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/SocketContext";

export function useModbus({ readRange = [0, 9], writeRange = [0, 9] }) {
  const [readRegisters, setReadRegisters] = useState(
    Array(readRange[1] - readRange[0] + 1).fill(0)
  );
  const [writeRegisters, setWriteRegisters] = useState(
    Array(writeRange[1] - writeRange[0] + 1).fill(0)
  );
  const socket = useSocket(); // Get the socket instance from context

  const fetchReadRegisters = useCallback(() => {
    if (socket) {
      socket.emit("request-modbus-data", { readRange });
    }
  }, [socket, readRange]);

  useEffect(() => {
    if (!socket) return; // Ensure the socket is available

    const handleModbusData = (data) => {
      // Assuming the data structure matches what's sent from the server
      setReadRegisters(data.registers || Array(10).fill(0));
    };
    // Request initial Modbus data
    // socket.emit("request-modbus-data", { readRange });

    // Listen for Modbus data updates
    socket.on("modbus-data", handleModbusData);
    fetchReadRegisters(); // Initial fetch

    return () => {
      socket.off("modbus-data", handleModbusData);
    };
  }, [fetchReadRegisters]);

  const refreshReadRegisters = () => {
    fetchReadRegisters();
  };

  const handleWriteChange = useCallback((index, value) => {
    const newValue = parseInt(value, 10) || 0;
    setWriteRegisters((prev) => {
      const newRegisters = [...prev];
      newRegisters[index] = newValue;
      return newRegisters;
    });
  }, []);

  const handleWrite = useCallback(
    (index) => {
      if (socket) {
        socket.emit("write-modbus-register", {
          index: writeRange[0] + index,
          value: writeRegisters[index],
        });
      }
    },
    [socket, writeRegisters, writeRange]
  );

  return {
    readRegisters,
    writeRegisters,
    handleWriteChange,
    handleWrite,
    refreshReadRegisters,
  };
}
