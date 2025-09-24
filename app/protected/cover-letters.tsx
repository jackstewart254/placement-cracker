"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./data-table";
import { getColumns, UnifiedCoverLetter } from "./columns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Raw response from Supabase for cover letters
type RawCoverLetter = {
  id: string;
  job_id: string;
  cover_letter?: string;
  jobs?: {
    job_title: string;
    created_at: string;
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

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);

  /**
   * Fetch jobs + cover letters for the current page
   */
  const fetchJobs = useCallback(
    async (currentPage = 1) => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          toast.error("Failed to fetch user information.");
          return;
        }

        const offset = (currentPage - 1) * PAGE_SIZE;

        // Fetch jobs with pagination
        const {
          data: jobs,
          error: jobsError,
          count,
        } = await supabase
          .from("jobs")
          .select("*", { count: "exact" })
          .range(offset, offset + PAGE_SIZE - 1)
          .order("created_at", { ascending: false });

        if (jobsError) throw jobsError;
        setTotalJobs(count || 0);

        if (!jobs || jobs.length === 0) {
          setAllJobs([]);
          return;
        }

        // Fetch companies
        const { data: companies, error: companiesError } = await supabase
          .from("companies")
          .select("id, name");
        if (companiesError) throw companiesError;

        // Fetch cover letters for only visible jobs
        const jobIds = jobs.map((job) => job.id);
        const { data: letters, error: lettersError } = await supabase
          .from("cover_letters")
          .select(
            `
            id,
            job_id,
            cover_letter,
            jobs!inner (
              job_title,
              created_at,
              company_id,
              url,
              companies!inner ( name )
            )
          `
          )
          .eq("user_id", user.id)
          .in("job_id", jobIds)
          .returns<RawCoverLetter[]>();

        if (lettersError) throw lettersError;

        // Build company lookup map
        const companyMap = (companies || []).reduce<Record<string, string>>(
          (acc, c) => {
            acc[c.id] = c.name;
            return acc;
          },
          {}
        );

        // Build cover letter map
        const letterMap = new Map<string, UnifiedCoverLetter>();
        for (const l of letters || []) {
          const job = l.jobs;
          const company = job?.companies;
          letterMap.set(l.job_id, {
            id: l.id,
            job_id: l.job_id,
            job_title: job?.job_title || "Untitled",
            company_name: company?.name || "Unknown",
            created_at: job?.created_at || "",
            url: job?.url || "",
            cover_letter: l.cover_letter,
          });
        }

        // Combine jobs + cover letters into unified list
        const unified: UnifiedCoverLetter[] = jobs.map((job) => {
          const existing = letterMap.get(job.id);
          return (
            existing || {
              id: job.id,
              job_id: job.id,
              job_title: job.job_title,
              company_name: companyMap[job.company_id] || "Unknown",
              created_at: job.created_at,
              url: job.url || "",
            }
          );
        });

        setAllJobs(unified);
      } catch (error: any) {
        console.error("Error fetching jobs data:", error?.message || error);
        toast.error(
          `Error fetching jobs: ${error?.message || "Unknown error"}`
        );
      }
    },
    [supabase]
  );

  useEffect(() => {
    setLoading(true);
    fetchJobs(page).finally(() => setLoading(false));
  }, [fetchJobs, page]);

  /**
   * Generate multiple cover letters for selected jobs
   */
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
                description: `Company: ${job.company_name}\nCreated At: ${job.created_at}\nURL: ${job.url}`,
              },
            ],
            input: "Write a professional cover letter tailored to this job.",
          }),
        });

        const result = await res.json();
        if (!result.success) {
          toast.error(`Error generating for ${job.job_title}`);
        }

        // Refresh data after each generated letter
        await fetchJobs(page);

        // Remove job from selected
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

  /**
   * Toggle job selection
   */
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

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
        >
          Previous
        </Button>

        <span className="text-sm">
          Page {page} of {Math.ceil(totalJobs / PAGE_SIZE) || 1}
        </span>

        <Button
          variant="outline"
          disabled={page >= Math.ceil(totalJobs / PAGE_SIZE)}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </Button>
      </div>

      {/* Dialog for viewing cover letters */}
      <Dialog
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
      </Dialog>
    </div>
  );
}
