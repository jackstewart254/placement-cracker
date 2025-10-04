"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Gift, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ReferralLabel() {
  const [credits, setCredits] = useState<{ cover: number; resolve: number }>({
    cover: 0,
    resolve: 0,
  });
  const [referral, setReferral] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const setup = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        return;
      }

      setIsLoggedIn(true);

      // Fetch credits
      const { data, error } = await supabase
        .from("user_credits")
        .select("cover_letter_credits, resolve_ai_credits")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setCredits({
          cover: data.cover_letter_credits,
          resolve: data.resolve_ai_credits,
        });
      }

      // Fetch referral separately
      const { data: referralData } = await supabase
        .from("individual_information")
        .select("referral")
        .eq("user_id", user.id)
        .single();

      if (referralData?.referral) {
        setReferral(referralData.referral);
      }

      // Subscribe for realtime credits updates
      const channel = supabase
        .channel("user_credits_changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_credits",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              setCredits({
                cover: payload.new.cover_letter_credits,
                resolve: payload.new.resolve_ai_credits,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setup();
  }, []);

  const handleCopy = async () => {
    if (!referral) return;

    const shareMessage = `I’ve been using Placement Cracker to instantly generate tailored cover letters and get AI-powered insights for placement applications. It’s genuinely helped me stand out — highly recommend giving it a try.

https://placementcracker.com/?ref=${referral}

Use my referral code: ${referral} to unlock free access.`;

    await navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full border-b py-2 px-4 h-12 flex items-center justify-center text-sm font-medium text-purple-800 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-20 pointer-events-none" />
      <Gift className="w-4 h-4 mr-2 relative z-10" />

      {isLoggedIn ? (
        <span className="relative z-10 flex flex-wrap items-center gap-2">
          You have <span className="font-bold">{credits.cover}</span> Cover
          Letters and <span className="font-bold">{credits.resolve}</span>{" "}
          ResolveAI Questions left. Share your code:
          {referral ? (
            <div className="flex items-center gap-1">
              <pre className="bg-gray-100 px-2 py-1 rounded text-xs font-mono flex items-center gap-2">
                {referral}
                <Button
                  onClick={handleCopy}
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </pre>
            </div>
          ) : (
            <span>Loading...</span>
          )}{" "}
          to unlock more free generations!
        </span>
      ) : (
        <div className="relative z-10 flex items-center gap-3">
          <span>
            Sign up now for <strong>free AI cover letters</strong> and{" "}
            <strong>tailored answers</strong> to your placement questions!
          </span>
          <Link href="/auth/sign-up">
            <Button size="sm" variant="default">
              Let’s Go →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
