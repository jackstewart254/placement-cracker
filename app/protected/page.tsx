import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import MetaInformation from "./projects-clients";
import CoverLetters from "./cover-letters";
import PersonalInformation from "./personal-information";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className=" flex gap-12 flex-col">
      <div className="w-full flex flex-col">
        <h2 className="font-bold text-2xl mb-4">Personal information</h2>
        <PersonalInformation />
      </div>
      <div className="w-full flex flex-col">
        <h2 className="font-bold text-2xl mb-4">Relevent information</h2>
        <p className="mb-4 text-sm font-normal text-muted-foreground">
          For each of the boxes below use Comma Seperated Values except Personal
          Projects where you will seperate them with paragraphing
        </p>
        <MetaInformation />
      </div>
      <div className="w-full">
        <h2 className="font-bold text-2xl mb-2">Cover Letters</h2>

        <CoverLetters />
      </div>
    </div>
  );
}
