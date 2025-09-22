"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface AvailableJob {
  job_id: string;
  job_title: string;
  opened: string;
  company_name: string;
}

export default function CoverLetters() {
  const supabase = createClient();
  const [coverLetters, setCoverLetters] = useState([]);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [render, setRender] = useState<boolean>(true);

  // Fetch data when component mounts or render state changes
  useEffect(() => {
    if (render === true) {
      fetchAvailableJobs();
    } else {
      fetchCoverLetters();
    }
  }, [render]);

  /**
   * Fetch all cover letters for the logged-in user
   */
  const fetchCoverLetters = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Error fetching user:",
        userError?.message || "No user found"
      );
      return;
    }

    const { data, error } = await supabase
      .from("cover_letters")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching cover letters:", error.message);
      return;
    }

    setCoverLetters(data || []);
  };

  /**
   * Fetch available jobs that the user hasn't generated a cover letter for yet
   */
  const fetchAvailableJobs = async () => {
    try {
      // 1. Get logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "Error fetching user:",
          userError?.message || "No user found"
        );
        return;
      }

      // 2. Fetch all jobs
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, job_title, opened, company_id");

      if (jobsError) {
        console.error("Error fetching jobs:", jobsError.message);
        return;
      }

      // 3. Fetch all cover letters for this user
      const { data: letters, error: lettersError } = await supabase
        .from("cover_letters")
        .select("job_id")
        .eq("user_id", user.id);

      if (lettersError) {
        console.error("Error fetching cover letters:", lettersError.message);
        return;
      }

      const existingJobIds = new Set(letters.map((letter) => letter.job_id));

      // 4. Filter jobs that don't have a cover letter yet
      const jobsWithoutCoverLetter = jobs.filter(
        (job) => !existingJobIds.has(job.id)
      );

      if (jobsWithoutCoverLetter.length === 0) {
        setAvailableJobs([]);
        return;
      }

      const companyIds = [
        ...new Set(jobsWithoutCoverLetter.map((job) => job.company_id)),
      ];

      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);

      if (companiesError) {
        console.error("Error fetching companies:", companiesError.message);
        return;
      }

      const companyMap = companies.reduce((acc, company) => {
        acc[company.id] = company.name;
        return acc;
      }, {} as Record<string, string>);

      // 6. Build final list of available jobs
      const available = jobsWithoutCoverLetter.map((job) => ({
        job_id: job.id,
        job_title: job.job_title,
        opened: job.opened,
        company_name: companyMap[job.company_id] || "Unknown Company",
      }));

      setAvailableJobs(available);
    } catch (error) {
      console.error("Unexpected error fetching available jobs:", error);
    }
  };

  /**
   * Handles switching between tabs
   */
  const handleRender = (newValue: boolean) => {
    setRender(newValue);
  };

  const renderAvailable = () => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {availableJobs.map((job) => (
          <button
            key={job.job_id}
            className="border rounded-md p-3 flex flex-col bg-accent items-start"
          >
            <div className="w-full flex flex-row justify-between">
              <h3 className="font-medium text-base mb-2">{job.job_title}</h3>
              <p className="text-xs">
                {format(new Date(job.opened), "EEE, do MMMM")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {job.company_name}
            </p>
          </button>
        ))}
      </div>
    );
  };

  const renderCoverLetters = () => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {coverLetters.map((letter: any) => (
          <div
            key={letter.id}
            className="border rounded-md p-3 flex flex-col bg-accent"
          >
            <p className="font-medium text-sm">Cover Letter #{letter.id}</p>
            <p className="text-xs text-muted-foreground">
              Job ID: {letter.job_id}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderEmpty = () => (
    <div className="flex items-center justify-center w-full">
      <p className="text-muted-foreground text-sm">No data available</p>
    </div>
  );

  return (
    <div className="flex w-full flex-col">
      {/* Toggle between "New" and "Generated" */}
      <div className="flex flex-row mb-4">
        <Button
          variant="ghost"
          className={`text-muted-foreground ${render ? "font-bold" : ""}`}
          onClick={() => handleRender(true)}
        >
          New
        </Button>
        <Button
          variant="ghost"
          className={`text-muted-foreground ${!render ? "font-bold" : ""}`}
          onClick={() => handleRender(false)}
        >
          Generated
        </Button>
      </div>

      {/* Render either Available Jobs or Generated Cover Letters */}
      <div className="w-full min-h-[32px] flex flex-row">
        {render
          ? availableJobs.length > 0
            ? renderAvailable()
            : renderEmpty()
          : coverLetters.length > 0
          ? renderCoverLetters()
          : renderEmpty()}
      </div>
    </div>
  );
}
