"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import Link from "next/link";
import { EnvVarWarning } from "./env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { ThemeSwitcher } from "./theme-switcher";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuthButtonClientProps {
  initialUser: any;
}

const navLinkClass =
  "relative font-medium transition duration-300 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-600";

export function AuthButtonClient({ initialUser }: AuthButtonClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(initialUser);
  const [menuValue, setMenuValue] = useState("");

  // map routes → select values
  useEffect(() => {
    if (pathname.startsWith("/placements")) setMenuValue("home");
    else if (pathname.startsWith("/account/cvs-and-letters"))
      setMenuValue("cvs");
    else if (pathname.startsWith("/account/profile")) setMenuValue("profile");
    else setMenuValue(""); // default
  }, [pathname]);

  // Listen for login/logout changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleMenuChange = (value: string) => {
    setMenuValue(value);
    if (value === "home") router.push("/placements");
    if (value === "cvs") router.push("/account/cvs-and-letters");
    if (value === "profile") router.push("/account/profile");
  };

  return (
    <div className="flex gap-4 items-center">
      <ThemeSwitcher />

      {/* Desktop Nav */}
      <div className="hidden md:flex gap-6 items-center">
        <Link href="/placements" className={navLinkClass}>
          Home
        </Link>
        <Link href="/account/chatbot" className={navLinkClass}>
          ResolveAI
        </Link>
        <Link href="/account/tracker" className={navLinkClass}>
          Tracker
        </Link>
        <Link href="/account/cvs-and-letters" className={navLinkClass}>
          CV's and Letters
        </Link>
        <Link href="/account/profile" className={navLinkClass}>
          Profile
        </Link>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden">
        <Select value={menuValue} onValueChange={handleMenuChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Menu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">Home</SelectItem>
            <SelectItem value="cvs">CV's and Letters</SelectItem>
            <SelectItem value="profile">Profile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* --- Logged Out State --- */}
      {!user ? (
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <>{!hasEnvVars && <EnvVarWarning />}</>
      )}
    </div>
  );
}
