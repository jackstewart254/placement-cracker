import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { HomeButtons } from "@/components/home-buttons";
import { ReferralTracker } from "@/components/referral-tracker"; // ✅ Import client component

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <ReferralTracker />
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        {/* Navbar */}
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link
                href="/"
                className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"
              >
                Placement Cracker
              </Link>
            </div>

            {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
          </div>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center max-w-5xl px-6 py-12 flex-col text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight bg-gradient-to-r from-blue-500 to-purple-600 text-transparent bg-clip-text">
            Land Your Dream Placement
          </h1>

          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mb-8">
            Instantly discover placements,{" "}
            <span className="font-semibold text-gray-800">
              generate tailored cover letters
            </span>
            , and get{" "}
            <span className="font-semibold text-gray-800">AI-powered help</span>{" "}
            answering application questions — all in one seamless platform.
          </p>

          <HomeButtons />
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p>Placement Cracker</p>
        </footer>
      </div>
    </main>
  );
}
