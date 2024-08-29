"use client";
import StyledTable from "@/comp/StyledTable";
import React from "react";
import { useCsvData } from "../../hooks";

function AdminPanel() {
  const csvData = useCsvData();
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <StyledTable csvData={csvData} />
    </div>
  );
}

export default AdminPanel;
