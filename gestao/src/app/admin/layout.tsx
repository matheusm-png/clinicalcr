import Sidebar from "@/components/Sidebar";
import AssistenteFlutuante from "@/components/AssistenteFlutuante";
import { ToastProvider } from "@/components/Toast";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
        <Sidebar />
        <div id="main">
          {children}
        </div>
        <AssistenteFlutuante />
      </div>
    </ToastProvider>
  );
}
