"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ReferralTracker() {
  useEffect(() => {
    const recordReferralVisit = async () => {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const referral = params.get("ref");

      if (!referral) return;

      // 1️⃣ Get the referral owner (referrer)
      const { data: referrer, error: referrerError } = await supabase
        .from("individual_information")
        .select("user_id")
        .eq("referral", referral)
        .maybeSingle();

      if (referrerError || !referrer?.user_id) return;

      // 2️⃣ Record visit in referral_visits
      await supabase.from("referral_visits").insert([
        {
          referral_id: referral,
          referred_id: referrer.user_id,
        },
      ]);
    };

    recordReferralVisit();
  }, []);

  return null; // invisible component
}
