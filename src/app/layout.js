/* eslint-disable react/prop-types */
// app/layout.js or app/layout.tsx
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { SocketProvider } from "@/SocketContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Dashboard",
  description: "Dark Themed Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SocketProvider>
          <div className="flex">
            {/* Sidebar with a fixed width */}
            <Sidebar />

            {/* Main content area */}
            <div className="flex-1 flex flex-col ml-64 bg-[#F3F4F6]">
              <TopBar />
              <main className="p-6 min-h-screen">{children}</main>
            </div>
          </div>
        </SocketProvider>
      </body>
    </html>
  );
}
