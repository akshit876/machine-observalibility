import { Card, CardContent, CardHeader } from "@/components/ui/card";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const StyledTable = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No data available</p>;
  }

  console.log({ data });

  // Define the headers for the table
  const headers = [
    { key: "SerialNumber", label: "Serial Number" },
    { key: "MarkingData", label: "Marking Data" },
    { key: "ScannerData", label: "Scanner Data" },
    // { key: "Shift", label: "Shift" },
    { key: "Result", label: "Result" },
    { key: "Timestamp", label: "Timestamp" },
    // { key: "OCRData", label: "OCR Data" },
    // { key: "Grade", label: "Grade" },
    // { key: "Status", label: "Status" },
  ];

  return (
    <Card className="w-full mt-8 shadow-lg overflow-hidden">
      <CardHeader>
        <h1 className="text-2xl font-bold text-gray-800">Scan Results</h1>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead
                    key={header.key}
                    className="bg-gray-50 text-left text-sm font-medium text-gray-500 py-3 px-4"
                  >
                    {header.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {headers.map((header) => (
                    <TableCell
                      key={header.key}
                      className="text-sm text-gray-700 py-3 px-4 whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {header.key === "Timestamp"
                        ? new Date(row[header.key]).toLocaleString()
                        : row[header.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default StyledTable;
