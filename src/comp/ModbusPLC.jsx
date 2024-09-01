/* eslint-disable no-nested-ternary */
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useModbus } from "../../hooks/useModbus";

const sections = [
  {
    title: "Input",
    readStart: parseInt(process.env.NEXT_PUBLIC_READ_START_1 || "300", 10),
    readEnd: parseInt(process.env.NEXT_PUBLIC_READ_END_1 || "315", 10),
    readBits: Array.from({ length: 16 }, (_, i) => i), // Bits 0 to 15
    labels: [
      "Start pushbutton -1",
      "Start pushbutton - 2",
      "Emergency Stop push button",
      "Safety Sensor",
      "Marking Complete",
      "Part Presence",
      "Scanner Read OK",
      "Read OCR OK",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
    ],
    readOnly: true, // Only read functionality
  },
  {
    title: "Output",
    writeStart: parseInt(process.env.NEXT_PUBLIC_WRITE_START_2 || "340", 10),
    writeEnd: parseInt(process.env.NEXT_PUBLIC_WRITE_END_2 || "355", 10),
    writeBits: Array.from({ length: 16 }, (_, i) => i), // Bits 0 to 15
    labels: [
      "Marking Start",
      "Scanner Trigger",
      "OCR Camera Trigger",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Tower Light Red",
      "Tower Light Green",
      "Tower Light Yellow",
      "Work Light",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
    ],
    readOnly: false, // Only write functionality
  },
  {
    title: "Software and PLC Input Status",
    readStart: parseInt(process.env.NEXT_PUBLIC_READ_START_3 || "340", 10),
    readEnd: parseInt(process.env.NEXT_PUBLIC_READ_END_3 || "355", 10),
    readBits: Array.from({ length: 16 }, (_, i) => i), // Bits 0 to 15
    labels: [
      "scanner data receive ok",
      "data sent to laser text file",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
    ],
    readOnly: true, // Only read functionality
  },
  {
    title: "Software and PLC Output Status",
    writeStart: parseInt(process.env.NEXT_PUBLIC_WRITE_START_4 || "380", 10),
    writeEnd: parseInt(process.env.NEXT_PUBLIC_WRITE_END_4 || "395", 10),
    writeBits: Array.from({ length: 16 }, (_, i) => i), // Bits 0 to 15
    labels: [
      "Marking start",
      "Scanner Trigger",
      "OCR Trigger",
      "Work Light",
      "Servo home",
      "Servo Scanner position",
      "Servo OCR Position",
      "Servo Marking Position",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
      "Spare",
    ],
    readOnly: false, // Only write functionality
  },
];

const useModbusSection = (
  readStart,
  readBits,
  writeStart,
  writeBits,
  readOnly
) => {
  const {
    readRegisters,
    writeRegisters,
    handleWriteChange,
    handleWrite,
    refreshReadRegisters,
  } = useModbus({
    readRange: readStart ? { register: readStart, bits: readBits } : undefined,
    writeRange: writeStart
      ? { register: writeStart, bits: writeBits }
      : undefined,
    readOnly,
  });

  return {
    readRegisters,
    writeRegisters,
    handleWriteChange,
    handleWrite,
    refreshReadRegisters,
  };
};

const ModbusUI = () => {
  const [writeValues, setWriteValues] = useState({});

  const handleInputChange = (index, value) => {
    setWriteValues((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {sections.map((section, sectionIndex) => {
        const {
          readRegisters,
          writeRegisters,
          handleWriteChange,
          handleWrite,
          refreshReadRegisters,
        } = useModbusSection(
          section.readStart,
          section.readBits,
          section.writeStart,
          section.writeBits,
          section.readOnly
        );

        return (
          <Card key={sectionIndex}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{section.title}</CardTitle>
              {section.readOnly && (
                <Button onClick={refreshReadRegisters}>Refresh</Button>
              )}
            </CardHeader>
            <CardContent>
              {section.readOnly &&
                readRegisters?.bits &&
                Object.entries(readRegisters?.bits)?.map(([k, v], index) => (
                  <div key={`read-${sectionIndex}-${index}`} className="mb-2">
                    <Label className='text-1xl font-bold '>{section.labels[index]}</Label>
                    <Input
                      type="text"
                      value={Number(v)}
                      readOnly
                      className="p-2"
                      style={{
                        backgroundColor:
                          Number(v) === 0
                            ? "red"
                            : Number(v) === 1
                              ? "green"
                              : "white",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    />
                  </div>
                ))}
              {!section.readOnly &&
                section.writeBits.map((bit, index) => (
                  <div
                    key={`write-${sectionIndex}-${index}`}
                    className="mb-4 flex items-center space-x-2"
                  >
                    <Label className='text-1xl font-bold '>{section.labels[index]}</Label>
                    <Input
                      type="number"
                      value={writeValues[index] || ""}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      className="flex-grow"
                    />
                    <Button
                      onClick={() =>
                        handleWrite({
                          address: section.writeStart,
                          bit,
                          value: writeValues[index],
                        })
                      }
                    >
                      Write
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ModbusUI;
