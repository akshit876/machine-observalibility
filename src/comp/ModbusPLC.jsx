"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useModbus } from "../../hooks/useModbus";
// import { useModbus } from "@/hooks/useModbus";

const ModbusUI = () => {
  const { readRegisters, writeRegisters, handleWriteChange, handleWrite } =
    useModbus({
      readRange: [300, 15],
      writeRange: [320, 15],
    });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Read Registers</CardTitle>
        </CardHeader>
        <CardContent>
          {readRegisters.map((value, index) => (
            <div key={`read-${index}`} className="mb-2">
              <Label>Register {index}</Label>
              <Input type="text" value={value} readOnly />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Write Registers</CardTitle>
        </CardHeader>
        <CardContent>
          {writeRegisters.map((value, index) => (
            <div
              key={`write-${index}`}
              className="mb-4 flex items-center space-x-2"
            >
              <Label className="w-24">Register {index}</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => handleWriteChange(index, e.target.value)}
                className="flex-grow"
              />
              <Button onClick={() => handleWrite(index)}>Write</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ModbusUI;
