import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Toaster } from "sonner";
import { AuthButton } from "@/components/auth-button";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header / Navigation */}
      <nav className="w-full border-b border-b-foreground/10 h-16 flex items-center justify-center">
        <div className="w-full flex justify-between items-center px-5 text-sm">
          {/* Left Section: Logo */}
          <div className="flex gap-5 items-center font-semibold">
            <Link href="/">PlacementCracker</Link>
          </div>

          <div className="flex items-center gap-3">
            {!hasEnvVars && <EnvVarWarning />}
            <AuthButton />
          </div>

          {/* Right Section: Auth + Env Warnings */}
        </div>
      </nav>

      {/* Main Content Area */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="flex-1 w-full flex overflow-hidden">
          <div className="w-full">
            {children}
            <Toaster position="top-right" richColors />
          </div>
        </div>
      </ThemeProvider>
    </main>
  );
}
