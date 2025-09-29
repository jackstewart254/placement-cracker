import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Chatbot from "./content";

const Home = async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }
  return <Chatbot />;
};

export default Home;
