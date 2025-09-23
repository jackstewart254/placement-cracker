"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

// ✅ Import Dialog Components from ShadCN
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AvailableJob {
  job_id: string;
  job_title: string;
  opened: string;
  company_name: string;
}

interface CoverLetter {
  id: string;
  job_id: string;
  cover_letter: string;
  job_title?: string;
  company_name?: string;
}

export default function CoverLetters() {
  const supabase = createClient();
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [render, setRender] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<AvailableJob | null>(null);
  const [openLetter, setOpenLetter] = useState<CoverLetter | null>(null); // <-- State for modal

  /**
   * Fetch data when component mounts or render state changes
   */
  useEffect(() => {
    if (render) {
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
      .select(
        `
        id,
        job_id,
        cover_letter,
        jobs (
          job_title,
          company_id,
          companies (name)
        )
      `
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching cover letters:", error.message);
      return;
    }

    // Format data so it's easier to use
    const formatted = data.map((item: any) => ({
      id: item.id,
      job_id: item.job_id,
      cover_letter: item.cover_letter,
      job_title: item.jobs?.job_title || "Untitled Job",
      company_name: item.jobs?.companies?.name || "Unknown Company",
    }));

    setCoverLetters(formatted || []);
  };

  /**
   * Fetch available jobs that don't have a cover letter yet
   */
  const fetchAvailableJobs = async () => {
    try {
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

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, job_title, opened, company_id");

      if (jobsError) {
        console.error("Error fetching jobs:", jobsError.message);
        return;
      }

      const { data: letters, error: lettersError } = await supabase
        .from("cover_letters")
        .select("job_id")
        .eq("user_id", user.id);

      if (lettersError) {
        console.error("Error fetching cover letters:", lettersError.message);
        return;
      }

      const existingJobIds = new Set(letters.map((letter) => letter.job_id));

      // Jobs without a cover letter
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
   * Handles checkbox toggle
   */
  const handleCheckboxChange = (jobId: string) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Please select at least one job.");
      return;
    }

    const selectedJobDetails = availableJobs.filter((job) =>
      selectedJobs.includes(job.job_id)
    );

    setLoading(true);
    setRender(false); // Switch to generated list view

    try {
      for (const job of selectedJobDetails) {
        setCurrentJob(job); // Track which job is currently being processed

        const res = await fetch("/api/generate-cover-letters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobs: [
              {
                id: job.job_id,
                job_title: job.job_title,
                description: `Company: ${job.company_name}\nOpened: ${job.opened}`,
              },
            ],
            input: "Write a professional cover letter tailored to this job.",
          }),
        });

        const result = await res.json();

        if (!result.success) {
          toast.error(`Error generating for ${job.job_title}`);
          continue;
        }

        // Add generated cover letter to the list
        setCoverLetters((prev) => [...prev, ...result.data]);
      }

      toast.success("Cover letters generated successfully!");
    } catch (err) {
      console.error("Error generating cover letters:", err);
      toast.error("Something went wrong generating cover letters.");
    } finally {
      setCurrentJob(null);
      setLoading(false);
      setSelectedJobs([]); // Reset selection
    }
  };

  /**
   * Available jobs with checkboxes
   */
  const renderAvailable = () => (
    <div className="flex flex-col gap-4 w-full">
      {availableJobs.map((job) => (
        <div
          key={job.job_id}
          className="flex flex-row items-center gap-2 border rounded-md p-3 bg-accent"
        >
          <Checkbox
            checked={selectedJobs.includes(job.job_id)}
            onCheckedChange={() => handleCheckboxChange(job.job_id)}
          />
          <div className="mx-2 bg-muted-foreground rounded-md w-[1px] h-full" />
          <div className="flex flex-col w-full">
            <div className="flex flex-row justify-between">
              <h3 className="font-medium text-sm">{job.job_title}</h3>
              <p className="text-xs">
                {format(new Date(job.opened), "EEE, do MMMM")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{job.company_name}</p>
          </div>
        </div>
      ))}

      {/* Show submit button only when one or more jobs are selected */}
      {selectedJobs.length > 0 && (
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Generating..." : "Generate Cover Letters"}
        </Button>
      )}
    </div>
  );

  /**
   * Render generated cover letters
   */
  const renderCoverLetters = () => (
    <div className="flex flex-col gap-2 w-full">
      {coverLetters.map((letter) => (
        <Dialog
          key={letter.id}
          open={openLetter?.id === letter.id}
          onOpenChange={(isOpen) => setOpenLetter(isOpen ? letter : null)}
        >
          <DialogTrigger asChild>
            <div
              onClick={() => setOpenLetter(letter)}
              className="cursor-pointer border rounded-md p-3 flex flex-col bg-accent hover:bg-accent/70 transition"
            >
              <p className="font-medium text-sm">
                {letter.job_title} - {letter.company_name}
              </p>
            </div>
          </DialogTrigger>

          {/* Modal Content */}
          <DialogContent className="max-w-5xl h-[70%] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                {letter.job_title} at {letter.company_name}
              </DialogTitle>
              <DialogDescription>
                Below is the generated cover letter for this job.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 whitespace-pre-wrap text-sm">
              {letter.cover_letter}
            </div>
          </DialogContent>
        </Dialog>
      ))}

      {loading && currentJob && (
        <Button size="sm" disabled className="flex justify-start gap-2 py-2">
          <Loader2Icon className="animate-spin" />
          <span>
            Generating: <strong>{currentJob.job_title}</strong> at{" "}
            <strong>{currentJob.company_name}</strong>
          </span>
        </Button>
      )}
    </div>
  );

  /**
   * Render empty state
   */
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
          onClick={() => setRender(true)}
        >
          New
        </Button>
        <Button
          variant="ghost"
          className={`text-muted-foreground ${!render ? "font-bold" : ""}`}
          onClick={() => setRender(false)}
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
          : coverLetters.length > 0 || loading
          ? renderCoverLetters()
          : renderEmpty()}
      </div>
    </div>
  );
}
