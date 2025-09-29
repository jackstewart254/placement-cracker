"use client";

import { useRouter } from "next/navigation";

export function HomeButtons() {
  const router = useRouter();

  return (
    <div className="flex gap-4">
      {/* Navigate to /signup */}
      <button
        onClick={() => router.push("/auth/sign-up")}
        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:opacity-90 transition"
      >
        Get Started
      </button>

      {/* Navigate to /protected */}
      <button
        onClick={() => router.push("/protected")}
        className="px-6 py-3 rounded-2xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-100 transition"
      >
        Explore Placements
      </button>
    </div>
  );
}
