import ModbusUI from "@/components/ModbusUI";

export default function ModbusPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Modbus Control Panel</h1>
      <ModbusUI />
    </div>
  );
}
