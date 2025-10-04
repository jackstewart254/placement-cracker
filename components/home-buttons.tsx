"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function HomeButtons() {
  const router = useRouter();
  const supabase = createClient(); // ✅ no need to use await here
  const [user, setUser] = useState(null); // State to store the current user
  const [loading, setLoading] = useState(true); // Loading state while checking session

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user || null);
      setLoading(false);
    };

    checkUser();
  }, [supabase]);

  if (loading) {
    return null; // or a loading spinner if you prefer
  }

  return (
    <div className="flex gap-4">
      {/* Only show Get Started if there is NO logged-in user */}
      {!user && (
        <button
          onClick={() => router.push("/auth/sign-up")}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:opacity-90 transition"
        >
          Get Started
        </button>
      )}

      {/* Always show Explore Placements */}
      <button
        onClick={() => router.push("/placements")}
        className="px-6 py-3 rounded-2xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-100 transition"
      >
        Explore Placements
      </button>
    </div>
  );
}
