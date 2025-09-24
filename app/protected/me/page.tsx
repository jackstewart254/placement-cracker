"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2Icon, ExternalLinkIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { DataTable } from "../data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ---------- Interfaces ---------- */
interface CoverLetterRow {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  created_at: string;
  url?: string;
  cover_letter?: string;
}

interface SavedApplicationRow {
  id: string;
  company_name: string;
  job_title?: string;
  status: string;
  priority?: string;
  applied_at?: string;
  last_touchpoint?: string;
  notes?: string;
  job_url?: string;
}

type RawCoverLetterRow = {
  id: string;
  job_id: string;
  created_at: string | null;
  cover_letter: string | null;
  jobs?: {
    job_title: string | null;
    url: string | null;
    created_at: string | null;
    companies?: {
      name: string | null;
    } | null;
  } | null;
};

type RawSavedApplicationRow = {
  id: string;
  status: string | null;
  applied_at: string | null;
  updated_at: string | null;
  saved_at: string | null;
  priority: string | null;
  notes: string | null;
  job_id: string | null;
  company_id: string | null;
  jobs?: {
    job_title: string | null;
    url: string | null;
  } | null;
  companies?: {
    name: string | null;
  } | null;
};

/* ---------- Utils ---------- */
const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return format(date, "PP");
  } catch (err) {
    console.error("Failed to format date", err);
    return "—";
  }
};

/* ---------- Main Component ---------- */
export default function MePage() {
  const supabase = createClient();

  const [coverLetters, setCoverLetters] = useState<CoverLetterRow[]>([]);
  const [coverLettersLoading, setCoverLettersLoading] = useState(true);
  const [coverLettersError, setCoverLettersError] = useState<string | null>(
    null
  );

  const [savedApplications, setSavedApplications] = useState<
    SavedApplicationRow[]
  >([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(
    null
  );

  // Instead of dialog, track selected cover letter
  const [selectedCoverLetter, setSelectedCoverLetter] =
    useState<CoverLetterRow | null>(null);

  // Toggle state: "coverLetters" or "applications"
  const [activeTable, setActiveTable] = useState<
    "coverLetters" | "applications"
  >("coverLetters");

  /* ---------- Load data ---------- */
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setCoverLettersLoading(true);
      setApplicationsLoading(true);
      setCoverLettersError(null);
      setApplicationsError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        const message = "You need to be signed in to view your data.";
        setCoverLettersError(message);
        setApplicationsError(message);
        setCoverLettersLoading(false);
        setApplicationsLoading(false);
        return;
      }

      /* ----- Fetch cover letters ----- */
      try {
        const { data, error } = await supabase
          .from("cover_letters")
          .select(
            `
            id,
            job_id,
            created_at,
            cover_letter,
            jobs!inner (
              job_title,
              url,
              created_at,
              companies!inner ( name )
            )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .returns<RawCoverLetterRow[]>();

        if (error) throw error;

        const mapped = (data || []).map<CoverLetterRow>((item) => ({
          id: item.id,
          job_id: item.job_id,
          job_title: item.jobs?.job_title ?? "Untitled role",
          company_name: item.jobs?.companies?.name ?? "Unknown company",
          created_at:
            item.jobs?.created_at ??
            item.created_at ??
            new Date().toISOString(),
          url: item.jobs?.url ?? undefined,
          cover_letter: item.cover_letter ?? undefined,
        }));

        if (!active) return;
        setCoverLetters(mapped);
      } catch (err) {
        if (!active) return;
        setCoverLettersError(
          err instanceof Error
            ? err.message
            : "Unable to load your cover letters right now."
        );
      } finally {
        if (!active) return;
        setCoverLettersLoading(false);
      }

      /* ----- Fetch saved applications ----- */
      try {
        const { data, error } = await supabase
          .from("saved_applications")
          .select(
            `
            id,
            status,
            applied_at,
            updated_at,
            saved_at,
            priority,
            notes,
            job_id,
            company_id,
            jobs ( job_title, url ),
            companies ( name )
          `
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .returns<RawSavedApplicationRow[]>();

        if (error) throw error;

        const mapped = (data || []).map<SavedApplicationRow>((item) => ({
          id: item.id,
          company_name: item.companies?.name ?? "Unknown company",
          job_title: item.jobs?.job_title ?? undefined,
          status: item.status ?? "saved",
          priority: item.priority ?? undefined,
          applied_at: item.applied_at ?? undefined,
          last_touchpoint:
            item.updated_at ?? item.saved_at ?? item.applied_at ?? undefined,
          notes: item.notes ?? undefined,
          job_url: item.jobs?.url ?? undefined,
        }));

        if (!active) return;
        setSavedApplications(mapped);
      } catch (err) {
        if (!active) return;
        const fallbackMessage =
          err instanceof Error &&
          /relation .*saved_applications/i.test(err.message)
            ? "You haven't saved any companies yet. Once you start tracking applications, they'll appear here."
            : err instanceof Error
            ? err.message
            : "Unable to load your saved applications right now.";
        setApplicationsError(fallbackMessage);
      } finally {
        if (!active) return;
        setApplicationsLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [supabase]);

  /* ---------- Data table columns ---------- */
  const coverLetterColumns = useMemo<ColumnDef<CoverLetterRow>[]>(
    () => [
      {
        accessorKey: "job_title",
        header: "Job Title",
        size: 400,
        cell: ({ row }) => (
          <div
            className="font-semibold leading-tight cursor-pointer"
            onClick={() => setSelectedCoverLetter(row.original)}
          >
            {row.original.job_title}
          </div>
        ),
      },
      {
        accessorKey: "company_name",
        header: "Company",
        size: 180,
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.original.company_name}
          </div>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        size: 140,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        accessorKey: "url",
        header: "Posting",
        size: 110,
        cell: ({ row }) =>
          row.original.url ? (
            <a
              href={row.original.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              View
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
    ],
    []
  );

  const statusColumns = useMemo<ColumnDef<SavedApplicationRow>[]>(
    () => [
      {
        accessorKey: "job_title",
        header: "Role",
        size: 400,
        cell: ({ row }) =>
          row.original.job_title ? (
            <div className="font-semibold leading-tight">
              {row.original.job_title}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "company_name",
        header: "Company",
        size: 220,
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.original.company_name}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 140,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        size: 120,
        cell: ({ row }) =>
          row.original.priority ? (
            <Badge variant="secondary" className="capitalize">
              {row.original.priority}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "applied_at",
        header: "Applied",
        size: 130,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.applied_at)}
          </span>
        ),
      },
      {
        accessorKey: "last_touchpoint",
        header: "Last Update",
        size: 140,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.last_touchpoint)}
          </span>
        ),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        size: 260,
        cell: ({ row }) =>
          row.original.notes ? (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {row.original.notes}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "job",
        header: "Job",
        size: 80,
        cell: ({ row }) =>
          row.original.job_url ? (
            <a
              href={row.original.job_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              Open
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col p-20 h-full">
      {/* Toggle Button */}
      <div className="flex justify-between items-center mb-4 w-full">
        <h2 className="text-lg font-semibold">
          {activeTable === "coverLetters"
            ? "Cover Letters"
            : "Application Tracker"}
        </h2>
        <Button
          variant="outline"
          onClick={() =>
            setActiveTable(
              activeTable === "coverLetters" ? "applications" : "coverLetters"
            )
          }
        >
          {activeTable === "coverLetters"
            ? "Switch to Applications"
            : "Switch to Cover Letters"}
        </Button>
      </div>

      {/* Main Content: Table and Preview */}
      <div className="flex gap-6 w-full max-h-[600px] h-auto overflow-clip">
        {/* Data Table Section */}
        <section className="flex-1 overflow-hidden">
          {activeTable === "coverLetters" ? (
            coverLettersLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DataTable columns={coverLetterColumns} data={coverLetters} />
            )
          ) : applicationsLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable columns={statusColumns} data={savedApplications} />
          )}
        </section>

        {activeTable === "coverLetters" && (
          <section className="w-1/3 border rounded-md p-4 h-auto overflow-auto bg-gray-800">
            <h3 className="text-lg font-semibold mb-2">
              {selectedCoverLetter
                ? selectedCoverLetter.job_title
                : "Select a cover letter"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedCoverLetter?.company_name || ""}
            </p>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {selectedCoverLetter?.cover_letter || "No cover letter selected."}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
