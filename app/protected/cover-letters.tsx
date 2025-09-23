"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./data-table";
import { getColumns, UnifiedCoverLetter } from "./columns";

// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";

// ✅ Define the type for the raw response from Supabase
type RawCoverLetter = {
  id: string;
  job_id: string;
  cover_letter?: string;
  jobs?: {
    job_title: string;
    opened: string;
    company_id: string;
    url?: string;
    companies?: {
      name: string;
    };
  };
};

export default function CoverLetters() {
  const supabase = createClient();
  const [allJobs, setAllJobs] = useState<UnifiedCoverLetter[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLetter, setOpenLetter] = useState<UnifiedCoverLetter | null>(null);

  const [currentGeneratingId, setCurrentGeneratingId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return;

    // Fetch base jobs
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, job_title, opened, company_id, url");

    // Fetch companies
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name");

    // Fetch cover letters and related jobs + companies
    const { data: letters } = await supabase
      .from("cover_letters")
      .select(
        `
        id,
        job_id,
        cover_letter,
        jobs!inner (
          job_title,
          opened,
          company_id,
          url,
          companies!inner (
            name
          )
        )
      `
      )
      .eq("user_id", user.id)
      .returns<RawCoverLetter[]>(); // ✅ Properly typed response

    // Create a map for company lookup
    const companyMap = (companies || []).reduce<Record<string, string>>(
      (acc, c) => {
        acc[c.id] = c.name;
        return acc;
      },
      {}
    );

    // ✅ Populate letterMap with cover letters
    const letterMap = new Map<string, UnifiedCoverLetter>();

    for (const l of letters || []) {
      const job = l.jobs; // ✅ single job object now
      const company = job?.companies; // ✅ single company object now

      letterMap.set(l.job_id, {
        id: l.id,
        job_id: l.job_id,
        job_title: job?.job_title || "Untitled",
        company_name: company?.name || "Unknown",
        opened: job?.opened || "",
        url: job?.url || "",
        cover_letter: l.cover_letter, // important!
      });
    }

    // ✅ Combine jobs and cover letters
    const unified: UnifiedCoverLetter[] = (jobs || []).map((job) => {
      const existing = letterMap.get(job.id);
      return (
        existing || {
          id: job.id,
          job_id: job.id,
          job_title: job.job_title,
          company_name: companyMap[job.company_id] || "Unknown",
          opened: job.opened,
          url: job.url || "",
        }
      );
    });

    setAllJobs(unified);
  }, [supabase]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleGenerateMultiple = async () => {
    const toGenerate = allJobs.filter(
      (j) => selected.has(j.job_id) && !j.cover_letter
    );
    if (toGenerate.length === 0) return toast.error("No jobs selected.");

    setLoading(true);

    try {
      for (const job of toGenerate) {
        setCurrentGeneratingId(job.job_id);

        const res = await fetch("/api/generate-cover-letters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobs: [
              {
                id: job.job_id,
                job_title: job.job_title,
                description: `Company: ${job.company_name}\nOpened: ${job.opened}\nURL: ${job.url}`,
              },
            ],
            input: "Write a professional cover letter tailored to this job.",
          }),
        });

        const result = await res.json();
        if (!result.success) {
          toast.error(`Error generating for ${job.job_title}`);
        }

        // Refresh after each job is generated
        await fetchJobs();

        // Remove from selected
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(job.job_id);
          return next;
        });
      }

      toast.success("All selected cover letters generated!");
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      setCurrentGeneratingId(null);
    }
  };

  const handleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpen = (row: UnifiedCoverLetter) => setOpenLetter(row);

  return (
    <div className="flex flex-col w-auto gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Applications</h2>
        <Button
          onClick={handleGenerateMultiple}
          disabled={loading || selected.size === 0}
        >
          {loading && <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />}
          Generate Selected
        </Button>
      </div>

      <div className="w-full overflow-auto">
        <DataTable
          columns={getColumns({
            onOpen: handleOpen,
            onSelect: handleSelect,
            selected,
            currentGeneratingId,
            loading,
          })}
          data={allJobs}
        />
      </div>

      {/* <Dialog
        open={!!openLetter}
        onOpenChange={(open) => {
          if (!open) setOpenLetter(null);
        }}
      >
        <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-[80vh] flex flex-col overflow-auto">
          <DialogHeader>
            <DialogTitle>{openLetter?.job_title}</DialogTitle>
            <DialogDescription>{openLetter?.company_name}</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm mt-4">
            {openLetter?.cover_letter}
          </div>
        </DialogContent>
      </Dialog> */}
    </div>
  );
}
