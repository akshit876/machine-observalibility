import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/SocketContext";

const ServoSettings = () => {
  const socket = useSocket();
  const [positions, setPositions] = useState({
    home: 0,
    scanner: 0,
    ocr: 0,
    mark: 0,
    fwdEndLimit: 0,
    revEndLimit: 0,
  });
  const [speeds, setSpeeds] = useState({
    home: 0,
    scanner: 0,
    ocr: 0,
    mark: 0,
  });

  useEffect(() => {
    socket.on("servo-data", (data) => {
      setPositions(data.positions);
      setSpeeds(data.speeds);
    });

    return () => {
      socket.off("servo-data");
    };
  }, []);

  const handlePositionChange = (key, value) => {
    const newValue = Math.min(Math.max(value, 1), 400);
    socket.emit("update-servo-position", { key, value: newValue });
  };

  const handleSpeedChange = (key, value) => {
    const newValue = Math.min(Math.max(value, 1), 2000);
    socket.emit("update-servo-speed", { key, value: newValue });
  };

  const handleServoHome = () => {
    socket.emit("servo-home");
  };

  const handleJog = (direction) => {
    socket.emit("servo-jog", { direction });
  };

  return (
    <div className="bg-black text-white p-4 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">SERVO SETTINGS</h2>
      <div className="grid grid-cols-4 gap-4">
        <div>Position/MM</div>
        <div>Speed/RPM</div>
        <div></div>
        <div></div>
        {Object.entries(positions).map(([key, value]) => (
          <React.Fragment key={key}>
            <div className="col-span-2">{key.toUpperCase()} POSITION</div>
            <Input
              type="number"
              value={value}
              onChange={(e) => handlePositionChange(key, e.target.value)}
              min={1}
              max={400}
              className="bg-green-500 text-black"
            />
            <Input
              type="number"
              value={speeds[key] || 0}
              onChange={(e) => handleSpeedChange(key, e.target.value)}
              min={1}
              max={2000}
              className="bg-green-500 text-black"
            />
          </React.Fragment>
        ))}
        <div className="col-span-2">FWD END LIMIT</div>
        <Input
          type="number"
          value={positions.fwdEndLimit}
          onChange={(e) => handlePositionChange("fwdEndLimit", e.target.value)}
          min={1}
          max={400}
          className="bg-green-500 text-black"
        />
        <Button onClick={() => handleJog("forward")} className="bg-blue-500">
          JOG FWD
        </Button>
        <div className="col-span-2">REV END LIMIT</div>
        <Input
          type="number"
          value={positions.revEndLimit}
          onChange={(e) => handlePositionChange("revEndLimit", e.target.value)}
          min={1}
          max={400}
          className="bg-green-500 text-black"
        />
        <Button onClick={() => handleJog("reverse")} className="bg-blue-500">
          JOG REV
        </Button>
      </div>
      <Button onClick={handleServoHome} className="mt-4 bg-red-500">
        SERVO HOME
      </Button>
    </div>
  );
};

export default ServoSettings;
