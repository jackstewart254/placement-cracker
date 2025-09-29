import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { EnvVarWarning } from "./env-var-warning";
import { hasEnvVars } from "@/lib/utils";

export async function AuthButton() {
  const supabase = await createClient();

  // Get current logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user → show Sign In / Sign Up
  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" variant="default">
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-center">
      <Link
        href="/protected"
        className="hover:text-primary transition-colors font-medium"
      >
        Home
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
    </div>
  );
}
