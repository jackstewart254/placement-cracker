"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Copy, Check, LogIn } from "lucide-react"; // icons for copy/confirm

export default function Page() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("referral");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleCopy = async () => {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // reset after 2s
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Thank you for signing up!
              </CardTitle>
              <CardDescription className="text-left">
                Check your email to confirm
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 items-start">
              <p className="text-sm text-muted-foreground text-left">
                You&apos;ve successfully signed up. Please check your email to
                confirm your account before signing in.
              </p>

              <Separator />

              {referralCode && (
                <div className="text-center w-full">
                  <div className="flex flex-col items-center gap-2">
                    <pre className="bg-gray-100 p-3 rounded-md text-lg font-mono w-full text-center">
                      {referralCode}
                    </pre>
                    <Button
                      onClick={handleCopy}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="mt-4 text-sm font-medium text-left">
                    This is your referral code. Share it and get friends to sign
                    up for <strong>free access</strong> to:
                  </p>
                  <p className="text-sm mt-2 text-muted-foreground text-left mb-4">
                    <strong>3</strong> Cover Letter Generations{" "}
                    <strong>And</strong> <strong>5</strong> ResolveAI Questions{" "}
                    <strong>for every friend</strong> you sign up!
                  </p>
                  <Button
                    onClick={() => router.push("/auth/login")}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    Login
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
