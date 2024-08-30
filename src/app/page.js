"use client";
import StyledTable from "@/comp/StyledTable";
import React from "react";
import { useCsvData } from "../../hooks";

function AdminPanel() {
  // const csvData = useCsvData();
  const { csvData, loading } = useCsvData();

  if (loading) {
    return <div className="text-center py-4">Loading...</div>; // Display loader while data is being fetched
  }
  console.log({ csvData });
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <StyledTable csvData={csvData} />
    </div>
  );
}

export default AdminPanel;
