import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CVsAndLetters from "./content";

const Home = async () => {
  const supabase = await createClient(); // <- Use server client here

  // Fetch current user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }
  return (
    <Suspense fallback={<div>Loading cover letters...</div>}>
      <CVsAndLetters />
    </Suspense>
  );
};

export default Home;
