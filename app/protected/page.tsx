import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Cards from "./cards";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Cards />
      </div>
    </div>
  );
}
