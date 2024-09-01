"use client";

import ModbusUI from "@/comp/ModbusPLC";

export default function ModbusPage() {
  return (
    <div className="px-[5px]">
      <h1 className="text-3xl font-bold mb-6">PLC Control Panel</h1>
      <ModbusUI />
    </div>
  );
}
