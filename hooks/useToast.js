/* eslint-disable consistent-return */
"use client";

import { useEffect } from "react";
import { toast } from "react-toastify";
import { useSocket } from "@/SocketContext";

export function useErrorToast() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleError = (error) => {
      toast.error(error.message || "An error occurred", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    };

    socket.on("error", handleError);

    return () => {
      socket.off("error", handleError);
    };
  }, [socket]);
}
