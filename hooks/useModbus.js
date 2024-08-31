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

  useEffect(() => {
    if (!socket) return; // Ensure the socket is available

    const handleRegisterUpdate = (data) => {
      if (data.index >= readRange[0] && data.index <= readRange[1]) {
        setReadRegisters((prev) => {
          const newRegisters = [...prev];
          newRegisters[data.index - readRange[0]] = data.value;
          return newRegisters;
        });
      }
    };

    socket.on("registerUpdate", handleRegisterUpdate);

    return () => {
      socket.off("registerUpdate", handleRegisterUpdate);
    };
  }, [socket, readRange]);

  const handleWriteChange = useCallback(
    (index, value) => {
      if (index >= writeRange[0] && index <= writeRange[1]) {
        const newValue = parseInt(value, 10) || 0;
        setWriteRegisters((prev) => {
          const newRegisters = [...prev];
          newRegisters[index - writeRange[0]] = newValue;
          return newRegisters;
        });
      }
    },
    [writeRange]
  );

  const handleWrite = useCallback(
    (index) => {
      if (socket && index >= writeRange[0] && index <= writeRange[1]) {
        socket.emit("writeRegister", {
          index,
          value: writeRegisters[index - writeRange[0]],
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
  };
}
