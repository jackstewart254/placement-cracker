import { EnvVarWarning } from "@/components/env-var-warning";
// import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Toaster } from "sonner";

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
            <Link href="/protected">PlacementCracker</Link>
          </div>

          {/* Center Section: Navigation Links */}
          <div className="flex gap-6">
            <Link
              href="/protected"
              className="hover:text-primary transition-colors font-medium"
            >
              Home
            </Link>
            <Link
              href="/protected/profile"
              className="hover:text-primary transition-colors font-medium"
            >
              Profile
            </Link>
          </div>

          {/* Right Section: Environment Check */}
          {!hasEnvVars && <EnvVarWarning />}
        </div>
      </nav>

      {/* Main Content Area - grows and fills all space between header and footer */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="flex-1 w-full flex overflow-hidden">
          <div className="w-full">
            {children}
            <Toaster position="top-right" richColors />
          </div>
        </div>
      </ThemeProvider>

      {/* Footer */}
      {/* <footer className="w-full border-t h-16 flex items-center justify-center text-xs gap-8">
        <p>
          Powered by{" "}
          <a
            href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
            target="_blank"
            className="font-bold hover:underline"
            rel="noreferrer"
          >
            Supabase
          </a>
        </p>
        <ThemeSwitcher />
      </footer> */}
    </main>
  );
}
