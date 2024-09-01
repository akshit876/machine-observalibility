/* eslint-disable consistent-return */
import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/SocketContext";

export function useModbus({
  readRange = {
    register: 100,
    bits: [0, 2, 5],
  },
  writeRange = {
    register: 100,
    bits: [0, 2, 5],
  },
}) {
  const [readRegisters, setReadRegisters] = useState(
    Array(readRange.bits.length).fill(0)
  );
  const [writeRegisters, setWriteRegisters] = useState(
    Array(writeRange.bits.length).fill(0)
  );
  const [refresh, setRefresh] = useState(false);
  const socket = useSocket(); // Get the socket instance from context

  const fetchReadRegisters = useCallback(() => {
    if (socket) {
      socket.emit("request-modbus-data", {
        register: readRange.register,
        bits: readRange.bits,
        interval: 500,
      });
    }
  }, [refresh]);

  useEffect(() => {
    if (!socket) return; // Ensure the socket is available

    const handleModbusData = ({ register, value, bits }) => {
      // Assuming the data structure matches what's sent from the server
      console.log(`Received data for register ${register}:`);
      console.log(`Full register value: ${value}`);
      console.log("Bit values:", bits);
      setReadRegisters(bits || Array(10).fill(0));
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
    setRefresh(true);
    fetchReadRegisters();
    setRefresh(false);
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
          address: writeRange.register + index,
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
