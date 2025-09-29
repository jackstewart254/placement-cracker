import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

// Components for user data
import PersonalInformation from "./components/personal-information";
import MetaInformation from "./components/user-information";

export default async function ProfilePage() {
  const supabase = await createClient();

  // Check if the user is authenticated
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="flex flex-col gap-12 p-20 w-full">
      {/* Personal Information Section */}
      <div className="w-full flex flex-col">
        <h2 className="font-bold text-2xl mb-4">Personal Information</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Keep your personal details up to date so they can be automatically
          included in your applications.
        </p>
        <PersonalInformation />
      </div>

      {/* Relevant Information Section */}
      <div className="w-full flex flex-col">
        <h2 className="font-bold text-2xl mb-4">Relevant Information</h2>
        <p className="mb-4 text-sm font-normal text-muted-foreground">
          Enter comma-separated values for each category below, except{" "}
          <strong>Personal Projects</strong>, where you should use paragraph
          formatting.
        </p>
        <MetaInformation />
      </div>
      <LogoutButton />
    </div>
  );
}
