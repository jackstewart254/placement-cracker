"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Loader2Icon, ChevronDownIcon } from "lucide-react";

// List of status options
const STATUS_OPTIONS = [
  "Application Submitted",
  "Online Assessment",
  "Case Study",
  "HireVue",
  "Telephone Interview",
  "Video Interview",
  "Face-to-face Interview",
  "Assessment Centre",
  "Offer Received",
  "Rejected",
  "Not Interested",
  "Not Applied",
];

interface TrackingRow {
  id: string;
  status: string;
  auto_favourite: boolean;
  cover_letter_id?: string;
  job: {
    id: string;
    job_title: string;
    deadline?: string;
    url?: string;
    company: {
      id: string;
      name: string;
    };
  };
}

export default function TrackerPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [trackingData, setTrackingData] = useState<TrackingRow[]>([]);

  /**
   * Fetch all tracked jobs with related job and company data
   */
  const fetchTrackingData = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error("Unable to fetch user session");
        return;
      }

      const { data, error } = await supabase
        .from("tracking")
        .select(
          `
          id,
          status,
          auto_favourite,
          cover_letter_id,
          job:jobs(
            id,
            job_title,
            deadline,
            url,
            company:companies(
              id,
              name
            )
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTrackingData(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load tracker data");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTrackingData();
  }, [fetchTrackingData]);

  /**
   * Update status for a specific tracked job
   */
  const updateStatus = async (trackingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("tracking")
        .update({ status: newStatus })
        .eq("id", trackingId);

      if (error) throw error;

      toast.success(`Status updated to "${newStatus}"`);
      setTrackingData((prev) =>
        prev.map((row) =>
          row.id === trackingId ? { ...row, status: newStatus } : row
        )
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update status");
    }
  };

  /**
   * Render
   */
  return (
    <div className="p-20">
      <h1 className="text-2xl font-bold mb-6">Application Tracker</h1>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : trackingData.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          No tracked applications yet.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Cover Letter</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {trackingData.map((row) => (
                <TableRow key={row.id}>
                  {/* Job Title */}
                  <TableCell className="font-medium">
                    {row.job?.job_title || "Untitled"}
                  </TableCell>

                  {/* Company */}
                  <TableCell>{row.job?.company?.name || "Unknown"}</TableCell>

                  {/* Status Dropdown */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          {row.status || "Not Applied"}
                          <ChevronDownIcon className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {STATUS_OPTIONS.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => updateStatus(row.id, status)}
                          >
                            {status}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  {/* Deadline */}
                  <TableCell>
                    {row.job?.deadline
                      ? format(new Date(row.job.deadline), "EEE, do MMM yyyy")
                      : "No deadline"}
                  </TableCell>

                  {/* Cover Letter Button */}
                  <TableCell className="text-right">
                    {row.cover_letter_id ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/protected/cvs-and-letters?job_id=${row.job.id}`
                          )
                        }
                      >
                        View Cover Letter
                      </Button>
                    ) : (
                      <span className="text-gray-400 text-sm">
                        Not Generated
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
