import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "pawbnb_ref_code";

/**
 * Captures ?ref=CODE from any URL and, once a user is signed in,
 * attaches them to the referrer exactly once.
 */
export const useReferralCapture = () => {
  const { user } = useAuth();
  const location = useLocation();

  // 1. Capture the code from the URL
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("ref");
    if (code) {
      try {
        localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase());
      } catch {
        /* storage unavailable */
      }
    }
  }, [location.search]);

  // 2. Redeem it after sign-in / sign-up
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const redeem = async () => {
      let code: string | null = null;
      try {
        code = localStorage.getItem(STORAGE_KEY);
      } catch {
        return;
      }
      if (!code) return;

      // Already referred?
      const { data: existing } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (existing) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const { data: owner } = await supabase
        .from("referral_codes")
        .select("user_id")
        .eq("code", code)
        .maybeSingle();
      if (cancelled) return;
      if (!owner || owner.user_id === user.id) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const { error } = await supabase.from("referrals").insert({
        referrer_id: owner.user_id,
        referred_user_id: user.id,
        code,
        status: "pending",
      });
      if (!error) localStorage.removeItem(STORAGE_KEY);
    };

    redeem();
    return () => {
      cancelled = true;
    };
  }, [user]);
};
