/* eslint-disable consistent-return */
import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/SocketContext";

export function useModbus({ readRange, writeRange, readOnly = false }) {
  const [readRegisters, setReadRegisters] = useState({});
  const [writeRegisters, setWriteRegisters] = useState({});
  const [refresh, setRefresh] = useState(false);
  const socket = useSocket(); // Get the socket instance from context

  const fetchReadRegisters = useCallback(() => {
    if (socket && readOnly) {
      socket.emit("request-modbus-data", {
        register: readRange.register,
        bits: readRange.bits,
        interval: 500,
      });
    }
  }, [refresh, readOnly]);

  useEffect(() => {
    if (!socket || !readOnly) return; // Ensure the socket is available and readOnly is true

    const handleModbusData = ({ register, value, bits }) => {
      // Assuming the data structure matches what's sent from the server
      console.log(`Received data for register ${register}:`);
      console.log(`Full register value: ${value}`);
      console.log("Bit values:", bits);
      setReadRegisters({ register, value, bits } || {});
    };

    // Listen for Modbus data updates
    socket.on("modbus-data", handleModbusData);
    fetchReadRegisters(); // Initial fetch

    return () => {
      socket.off("modbus-data", handleModbusData);
    };
  }, [fetchReadRegisters, readOnly]);

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
    (address, bit, value) => {
      if (socket) {
        socket.emit("write-modbus-register", {
          address,
          bit,
          value,
        });
      }
    },
    [socket]
  );

  return {
    readRegisters,
    writeRegisters,
    handleWriteChange,
    handleWrite,
    refreshReadRegisters,
  };
}
