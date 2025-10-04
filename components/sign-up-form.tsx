"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const supabase = createClient();

  const generateReferralCode = (length = 8) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  };

  // ---------- Step Control ----------
  const [step, setStep] = useState(1);

  // ---------- Step 1 State ----------
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [referralInput, setReferralInput] = useState(""); // ✅ new field

  // ---------- Step 2 State ----------
  const [university, setUniversity] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [degree, setDegree] = useState("");

  // ---------- Shared State ----------
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ---------- Regex Validation ----------
  const nameRegex = /^([A-Za-z]{2,})(\s[A-Za-z]{2,})+$/;
  const yearRegex = /^[1-9]\d*$/;
  const degreeRegex = /^(BSc|BA|MSc|MA|PhD|MBA)\b/i;
  const passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  // ---------- Step 1 Submission ----------
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!nameRegex.test(fullName)) {
      setError(
        "Full name must include first and last name, each at least 2 letters."
      );
      setIsLoading(false);
      return;
    }

    if (!passwordRegex.test(password)) {
      setError(
        "Password must be at least 8 characters long and include a letter, a number, and a special character."
      );
      setIsLoading(false);
      return;
    }

    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/placements` },
        });

      if (signUpError) throw signUpError;

      const newUserId = signUpData?.user?.id;
      if (!newUserId) throw new Error("User ID not returned after signup");

      setUserId(newUserId);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "An error occurred during signup.");
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- Step 2 Submission ----------
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!yearRegex.test(yearOfStudy)) {
      setError("Year of study must be a positive number greater than 0.");
      setIsLoading(false);
      return;
    }

    if (!degreeRegex.test(degree)) {
      setError("Degree must start with BSc, BA, MSc, MA, PhD, or MBA.");
      setIsLoading(false);
      return;
    }

    if (!university.trim()) {
      setError("University cannot be empty.");
      setIsLoading(false);
      return;
    }

    const referralCode = generateReferralCode();

    try {
      // Insert into individual_information
      const { error: infoError } = await supabase
        .from("individual_information")
        .insert([
          {
            user_id: userId,
            full_name: fullName,
            university,
            year_of_study: Number(yearOfStudy),
            degree,
            referral: referralCode,
          },
        ]);
      if (infoError) throw infoError;

      // Insert starting credits
      const { error: creditsError } = await supabase
        .from("user_credits")
        .insert([
          {
            user_id: userId,
            cover_letter_credits: 3,
            resolve_ai_credits: 5,
          },
        ]);
      if (creditsError) throw creditsError;

      // ✅ If referralInput exists, log it in referrals table
      if (referralInput.trim()) {
        // Find the referrer_id
        const { data: referrerData } = await supabase
          .from("individual_information")
          .select("user_id")
          .eq("referral", referralInput.trim())
          .single();

        if (referrerData?.user_id) {
          await supabase.from("referrals").insert([
            {
              referrer_id: referrerData.user_id,
              referred_id: userId,
              referral_code: referralInput.trim(),
            },
          ]);
        }
      }

      // Redirect
      router.push(`/thank-you?referral=${referralCode}`);
    } catch (err: any) {
      setError(err.message || "An error occurred while saving info.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>
            {step === 1 ? "Create your account" : "Tell us about your studies"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={step === 1 ? handleStep1 : handleStep2}>
            <div className="flex flex-col gap-6">
              {/* -------- STEP 1 -------- */}
              {step === 1 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input
                      id="full-name"
                      type="text"
                      placeholder="John Doe"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters, 1 number, 1 special character"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">Repeat Password</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  </div>

                  {/* ✅ Referral Code (optional) */}
                  <div className="grid gap-2">
                    <Label htmlFor="referral-code">
                      Referral Code{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="referral-code"
                      type="text"
                      placeholder="Enter referral code if you have one"
                      value={referralInput}
                      onChange={(e) =>
                        setReferralInput(e.target.value.toUpperCase())
                      }
                    />
                  </div>
                </>
              )}

              {/* -------- STEP 2 -------- */}
              {step === 2 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="university">University</Label>
                    <Input
                      id="university"
                      type="text"
                      placeholder="Aston University"
                      required
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="year-of-study">Year of Study</Label>
                    <Input
                      id="year-of-study"
                      type="number"
                      placeholder="1"
                      min="1"
                      required
                      value={yearOfStudy}
                      onChange={(e) => setYearOfStudy(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="degree">Degree</Label>
                    <Input
                      id="degree"
                      type="text"
                      placeholder="BSc Computer Science"
                      required
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                    />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex items-center justify-between mt-4">
                {step === 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                )}

                <Button type="submit" className="ml-auto" disabled={isLoading}>
                  {isLoading ? "Processing..." : step === 1 ? "Next" : "Finish"}
                </Button>
              </div>

              {step === 1 && (
                <div className="mt-4 text-center text-sm">
                  Already have an account?{" "}
                  <Link
                    href="/auth/login"
                    className="underline underline-offset-4"
                  >
                    Login
                  </Link>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
