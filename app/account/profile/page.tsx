import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfilePage from "./content";

const Home = async () => {
  const supabase = await createClient(); // <- Use server client here

  // Fetch current user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log("Current user:", user, error);

  if (error || !user) {
    redirect("/auth/login");
  }

  return (
    <div>
      <ProfilePage />
    </div>
  );
};

export default Home;
