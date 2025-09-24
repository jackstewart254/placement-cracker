"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2Icon } from "lucide-react";
import { format } from "date-fns";

export interface UnifiedCoverLetter {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  created_at: string; // ✅ Using created_at instead of opened
  url: string;
  cover_letter?: string;
}

interface GetColumnsParams {
  onOpen: (row: UnifiedCoverLetter) => void;
  onSelect: (job_id: string) => void;
  selected: Set<string>;
  currentGeneratingId: string | null;
  loading: boolean;
}

export function getColumns({
  onOpen,
  onSelect,
  selected,
  currentGeneratingId,
  loading,
}: GetColumnsParams): ColumnDef<UnifiedCoverLetter>[] {
  return [
    // Job Title
    {
      accessorKey: "job_title",
      header: "Job Title",
      size: 300,
      cell: ({ row }) => (
        <div className="truncate max-w-[280px]" title={row.original.job_title}>
          {row.original.job_title}
        </div>
      ),
    },

    // Company
    {
      accessorKey: "company_name",
      header: "Company",
      size: 160,
      cell: ({ row }) => (
        <div
          className="truncate max-w-[140px]"
          title={row.original.company_name}
        >
          {row.original.company_name}
        </div>
      ),
    },

    // Created At (formerly "Opened")
    {
      accessorKey: "created_at",
      header: "Created At",
      size: 140,
      cell: ({ row }) => {
        const date = new Date(row.original.created_at);
        return <span className="text-sm">{format(date, "EEE, do MMM")}</span>;
      },
    },

    // Link
    {
      accessorKey: "url",
      header: "Link",
      size: 90,
      cell: ({ row }) =>
        row.original.url ? (
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline text-sm"
          >
            View
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">N/A</span>
        ),
    },

    // Actions
    {
      id: "actions",
      header: "Action",
      size: 64,
      cell: ({ row }) => {
        const hasLetter = !!row.original.cover_letter;
        const isCurrent = currentGeneratingId === row.original.job_id;

        return (
          <div className="flex justify-center items-center h-full">
            <div className="w-6 h-6 flex justify-center items-center">
              {hasLetter ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2 text-xs"
                  onClick={() => onOpen(row.original)}
                >
                  Open
                </Button>
              ) : isCurrent ? (
                <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Checkbox
                  checked={selected.has(row.original.job_id)}
                  onCheckedChange={() => onSelect(row.original.job_id)}
                  disabled={loading}
                  className="transition-all"
                />
              )}
            </div>
          </div>
        );
      },
    },
  ];
}
