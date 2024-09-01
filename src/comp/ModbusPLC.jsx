/* eslint-disable no-nested-ternary */
"use client";

import React from "react";
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
    writeStart: parseInt(process.env.NEXT_PUBLIC_WRITE_START_1 || "320", 10),
    writeEnd: parseInt(process.env.NEXT_PUBLIC_WRITE_END_1 || "335", 10),
    readBits: Array.from({ length: 16 }, (_, i) => i),
    writeBits: Array.from({ length: 16 }, (_, i) => i),
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
  },
  {
    title: "Output",
    readStart: parseInt(process.env.NEXT_PUBLIC_READ_START_2 || "320", 10),
    readEnd: parseInt(process.env.NEXT_PUBLIC_READ_END_2 || "335", 10),
    writeStart: parseInt(process.env.NEXT_PUBLIC_WRITE_START_2 || "340", 10),
    writeEnd: parseInt(process.env.NEXT_PUBLIC_WRITE_END_2 || "355", 10),
    readBits: Array.from({ length: 16 }, (_, i) => i),
    writeBits: Array.from({ length: 16 }, (_, i) => i),
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
  },
  {
    title: "Software and PLC Input Status",
    readStart: parseInt(process.env.NEXT_PUBLIC_READ_START_3 || "340", 10),
    readEnd: parseInt(process.env.NEXT_PUBLIC_READ_END_3 || "355", 10),
    writeStart: parseInt(process.env.NEXT_PUBLIC_WRITE_START_3 || "360", 10),
    writeEnd: parseInt(process.env.NEXT_PUBLIC_WRITE_END_3 || "375", 10),
    readBits: Array.from({ length: 16 }, (_, i) => i),
    writeBits: Array.from({ length: 16 }, (_, i) => i),
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
  },
  {
    title: "Software and PLC Output Status",
    readStart: parseInt(process.env.NEXT_PUBLIC_READ_START_4 || "360", 10),
    readEnd: parseInt(process.env.NEXT_PUBLIC_READ_END_4 || "375", 10),
    writeStart: parseInt(process.env.NEXT_PUBLIC_WRITE_START_4 || "380", 10),
    writeEnd: parseInt(process.env.NEXT_PUBLIC_WRITE_END_4 || "395", 10),
    readBits: Array.from({ length: 16 }, (_, i) => i),
    writeBits: Array.from({ length: 16 }, (_, i) => i),
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
  },
];

const useModbusSection = (readStart, readBits, writeStart, writeBits) => {
  const {
    readRegisters,
    writeRegisters,
    handleWriteChange,
    handleWrite,
    refreshReadRegisters,
  } = useModbus({
    readRange: {
      register: readStart,
      bits: readBits,
    },
    writeRange: {
      register: writeStart,
      bits: writeBits,
    },
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
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
          section.writeBits
        );

        return (
          <Card key={sectionIndex}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{section.title}</CardTitle>
              <Button onClick={refreshReadRegisters}>Refresh</Button>
            </CardHeader>
            <CardContent>
              {readRegisters?.bits &&
                Object.entries(readRegisters?.bits)?.map(([k, v], index) => (
                  <div key={`read-${sectionIndex}-${index}`} className="mb-2">
                    <Label>{section.labels[index]}</Label>
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
              {writeRegisters?.map((value, index) => (
                <div
                  key={`write-${sectionIndex}-${index}`}
                  className="mb-4 flex items-center space-x-2"
                >
                  <Label>{`Register ${section.writeStart + index}`}</Label>
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
        );
      })}
    </div>
  );
};

export default ModbusUI;
