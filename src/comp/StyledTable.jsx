import { Card, CardContent, CardHeader } from "@/components/ui/card";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";

const StyledTable = ({ csvData }) => {
  if (!csvData || csvData.length === 0) {
    return <p>No data available</p>;
  }

  // Define the headers for the table
  const headers = ["Time", "Marking Data", "Result"];

  // Rows (assume the data does not include a header row in the CSV)
  const rows = csvData;

  return (
    <Card className="max-w-7xl mx-auto mt-8 shadow-lg">
      <CardHeader>
        <h1 className="text-2xl font-bold text-gray-800">Scan Results</h1>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="w-full table-auto">
            {/* <TableHead>
              <TableRow>
                {headers.map((header, index) => (
                  <TableHead
                    key={index}
                    className="bg-gray-50 text-left text-sm font-medium text-gray-500 border-b"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHead> */}
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={`border-b ${
                    rowIndex % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className="text-gray-700 border-b"
                    >
                      {cell.replace(/"/g, "")}{" "}
                      {/* Remove double quotes if any */}
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
