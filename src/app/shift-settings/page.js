import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/SocketContext";

const ShiftSetting = () => {
  const socket = useSocket();
  const [shifts, setShifts] = useState({
    A: "23456",
    B: "23456",
    C: "23456",
  });
  const [currentShift, setCurrentShift] = useState("A");

  useEffect(() => {
    socket.on("shift-update", (data) => {
      setShifts((prevShifts) => ({ ...prevShifts, ...data }));
    });

    socket.on("current-shift-update", (shift) => {
      setCurrentShift(shift);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleShiftChange = (shift, value) => {
    const newShifts = { ...shifts, [shift]: value };
    setShifts(newShifts);
    socket.emit("shift-change", { [shift]: value });
  };

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          SHIFT SETTING
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.entries(shifts).map(([shift, time]) => (
          <div key={shift} className="mb-4">
            <Label htmlFor={`shift-${shift}`} className="text-lg font-semibold">
              {shift} SHIFT
            </Label>
            <Input
              id={`shift-${shift}`}
              value={time}
              onChange={(e) => handleShiftChange(shift, e.target.value)}
              className="mt-1 text-2xl font-bold text-yellow-400 bg-black border-green-500"
            />
          </div>
        ))}
        <div className="mt-6">
          <Label className="text-lg font-semibold">Current Shift</Label>
          <div className="text-2xl font-bold text-yellow-400">
            {currentShift}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShiftSetting;
