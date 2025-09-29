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
      <Link
        href="/protected"
        className="hover:text-primary transition-colors font-medium"
      >
        Home
      </Link>

      {/* --- Logged Out State --- */}
      {!user ? (
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" variant="default">
            <Link href="/auth/sign-up">Sign up</Link>
          </Button>
        </div>
      ) : (
        /* --- Logged In State --- */
        <>
          <Link
            href="/protected/chatbot"
            className="hover:text-primary transition-colors font-medium"
          >
            Q-Answerer
          </Link>
          <Link
            href="/protected/tracker"
            className="hover:text-primary transition-colors font-medium"
          >
            Tracker
          </Link>

          <Link
            href="/protected/cvs-and-letters"
            className="hover:text-primary transition-colors font-medium"
          >
            CV's and Letters
          </Link>

          <Link
            href="/protected/profile"
            className="hover:text-primary transition-colors font-medium"
          >
            Profile
          </Link>

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
