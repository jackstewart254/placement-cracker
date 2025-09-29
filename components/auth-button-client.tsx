"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import Link from "next/link";
import { EnvVarWarning } from "./env-var-warning";
import { hasEnvVars } from "@/lib/utils";

interface AuthButtonClientProps {
  initialUser: any; // Supabase user object or null
}

const navLinkClass =
  "relative font-medium transition duration-300 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-600";

export function AuthButtonClient({ initialUser }: AuthButtonClientProps) {
  const supabase = createClient();
  const [user, setUser] = useState(initialUser);

  // Listen for login/logout changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <div className="flex gap-6 items-center">
      {/* ✅ Always visible Home link */}
      <Link href="/protected" className={navLinkClass}>
        Home
      </Link>

      <Link href="/protected/chatbot" className={navLinkClass}>
        Q-Answerer
      </Link>
      <Link href="/protected/tracker" className={navLinkClass}>
        Tracker
      </Link>

      <Link href="/protected/cvs-and-letters" className={navLinkClass}>
        CV's and Letters
      </Link>

      <Link href="/protected/profile" className={navLinkClass}>
        Profile
      </Link>
      {/* --- Logged Out State --- */}
      {!user ? (
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <>
          {!hasEnvVars && <EnvVarWarning />}

          {/* Optional Logout Button */}
          {/* <Button
            variant="outline"
            size="sm"
            onClick={async () => await supabase.auth.signOut()}
          >
            Logout
          </Button> */}
        </>
      )}
    </div>
  );
}
