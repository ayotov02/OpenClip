import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto pt-14">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
