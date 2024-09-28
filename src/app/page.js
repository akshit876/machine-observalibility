"use client";
import StyledTable from "@/comp/StyledTable";
import React from "react";
import { useCsvData } from "../../hooks";
import { useProtectedRoute } from "../../hooks/useProtectedRoute";

function AdminPanel() {
  // const csvData = useCsvData();
  const { csvData, loading } = useCsvData();

  // const { session, status } = useProtectedRoute();

  // if (status === "loading") {
  //   return <div>Loading...</div>;
  // }

  // if (!session) {
  //   return null;
  // }

  // if (loading) {
  //   return <div className="text-center py-4">Loading...</div>; // Display loader while data is being fetched
  // }
  console.log({ csvData });
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <StyledTable data={csvData?.data} />
    </div>
  );
}

export default AdminPanel;
