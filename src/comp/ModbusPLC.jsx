/* eslint-disable no-nested-ternary */
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useModbus } from "../../hooks/useModbus";

const readStart = parseInt(process.env.NEXT_PUBLIC_READ_START || "300", 10);
const readEnd = parseInt(process.env.NEXT_PUBLIC_READ_END || "315", 10);
const writeStart = parseInt(process.env.NEXT_PUBLIC_WRITE_START || "320", 10);
const writeEnd = parseInt(process.env.NEXT_PUBLIC_WRITE_END || "335", 10);

const readbits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const writebits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const ModbusUI = () => {
  const {
    readRegisters,
    writeRegisters,
    handleWriteChange,
    handleWrite,
    refreshReadRegisters,
  } = useModbus({
    readRange: {
      register: readStart,
      bits: readbits,
    },
    writeRange: {
      register: writeStart,
      bits: writebits,
    },
  });

  console.log({ readRegisters });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Read Registers</CardTitle>
          <Button onClick={refreshReadRegisters}>Refresh</Button>
        </CardHeader>
        <CardContent>
          {readRegisters?.bits &&
            Object.entries(readRegisters?.bits)?.map(([k, v], index) => (
              <div key={`read-${index}`} className="mb-2">
                <Label>
                  {`Register ${readRegisters?.register} -> Bit [${k}]`}
                </Label>
                <Input
                  type="text"
                  value={Number(v)}
                  readOnly
                  className={`${Number(v) === 0 ? "bg-red-500" : Number(v) === 1 ? "bg-green-500" : ""}`}
                />
              </div>
            ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Write Registers</CardTitle>
        </CardHeader>
        <CardContent>
          {/* {writeRegisters.map((value, index) => (
            <div
              key={`write-${index}`}
              className="mb-4 flex items-center space-x-2"
            >
              <Label>
                Register <strong>{readStart + index}</strong>
              </Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => handleWriteChange(index, e.target.value)}
                className="flex-grow"
              />
              <Button onClick={() => handleWrite(index)}>Write</Button>
            </div>
          ))} */}
        </CardContent>
      </Card>
    </div>
  );
};

export default ModbusUI;
