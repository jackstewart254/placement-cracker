"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export interface UnifiedCoverLetter {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  created_at: string;
  location?: string;
  url: string;
  cover_letter?: string;
  description?: string;
  category?: string;
  job_type?: string;
}

export interface interfaceCoverLetter {
  id: string;
  cover_letter: string;
  job_id: string;
  created_at: Date;
  user_id: string;
}

export default function Cards() {
  const supabase = createClient();

  const [allJobs, setAllJobs] = useState<UnifiedCoverLetter[]>([]);
  const [selectedJob, setSelectedJob] = useState<UnifiedCoverLetter | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [currentGeneratingId, setCurrentGeneratingId] = useState<string | null>(
    null
  );

  // Cover letters
  const [coverLetters, setCoverLetters] = useState<interfaceCoverLetter[]>([]);

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const jobListRef = useRef<HTMLDivElement | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedJobType, setSelectedJobType] = useState("all");

  // Filter options
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [jobTypeOptions, setJobTypeOptions] = useState<string[]>([]);

  /**
   * Fetch jobs, companies, and cover letters
   */
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error("Failed to fetch user information.");
        return;
      }

      // 1. Fetch cover letters for current user
      const { data: letters, error: lettersError } = await supabase
        .from("cover_letters")
        .select("*")
        .eq("user_id", user.id);

      if (lettersError) throw lettersError;
      setCoverLetters(letters || []);

      // 2. Fetch jobs (newest first)
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;
      if (!jobs || jobs.length === 0) {
        setAllJobs([]);
        return;
      }

      // 3. Fetch companies
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, name");

      if (companiesError) throw companiesError;

      const companyMap = (companies || []).reduce<Record<string, string>>(
        (acc, c) => {
          acc[c.id] = c.name;
          return acc;
        },
        {}
      );

      // 4. Merge jobs and cover letters
      const unified: UnifiedCoverLetter[] = jobs.map((job) => {
        const jobCoverLetter = letters?.find(
          (letter) => letter.job_id === job.id
        );
        return {
          id: job.id,
          job_id: job.id,
          job_title: job.job_title,
          company_name: companyMap[job.company_id] || "Unknown",
          created_at: job.created_at,
          location: job.location || "Not specified",
          description: job.description || "",
          category: job.category || "",
          job_type: job.job_type || "",
          url: job.url || "",
          cover_letter: jobCoverLetter?.cover_letter || undefined,
        };
      });

      setAllJobs(unified);

      // Update filter dropdowns
      setCompanyOptions(
        [...new Set(unified.map((j) => j.company_name))].sort()
      );
      setCategoryOptions(
        [...new Set(unified.map((j) => j.category || "Uncategorized"))].sort()
      );
      setJobTypeOptions(
        [...new Set(unified.map((j) => j.job_type || "Other"))].sort()
      );

      if (unified.length > 0 && !selectedJob) {
        setSelectedJob(unified[0]);
      }
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      toast.error(`Error fetching jobs: ${error?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedJob]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  /**
   * Scroll to top when page changes
   */
  useEffect(() => {
    if (jobListRef.current) {
      jobListRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [page]);

  /**
   * Filtering logic
   */
  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      const matchesSearch =
        job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCompany =
        selectedCompany !== "all" ? job.company_name === selectedCompany : true;
      const matchesCategory =
        selectedCategory !== "all" ? job.category === selectedCategory : true;
      const matchesJobType =
        selectedJobType !== "all" ? job.job_type === selectedJobType : true;

      return (
        matchesSearch && matchesCompany && matchesCategory && matchesJobType
      );
    });
  }, [allJobs, searchTerm, selectedCompany, selectedCategory, selectedJobType]);

  /**
   * Paginate
   */
  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredJobs.slice(start, start + PAGE_SIZE);
  }, [filteredJobs, page]);

  const totalPages = Math.ceil(filteredJobs.length / PAGE_SIZE);

  /**
   * Select a job
   */
  const handleSelectJob = (job: UnifiedCoverLetter) => {
    setSelectedJob(job);
  };

  /**
   * Generate a cover letter
   */
  const handleGenerateCoverLetter = async (job: UnifiedCoverLetter) => {
    setLoading(true);
    setCurrentGeneratingId(job.job_id);

    try {
      const res = await fetch("/api/generate-cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs: [
            {
              id: job.job_id,
              job_title: job.job_title,
              description: `Company: ${job.company_name}\nLocation: ${job.location}\nCategory: ${job.category}\nCreated At: ${job.created_at}\nURL: ${job.url}`,
            },
          ],
          input: "Write a professional cover letter tailored to this job.",
        }),
      });

      const result = await res.json();
      if (!result.success) {
        toast.error(`Error generating cover letter for ${job.job_title}`);
      } else {
        toast.success(`Cover letter generated for ${job.job_title}`);
      }

      await fetchJobs();
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong while generating cover letter");
    } finally {
      setLoading(false);
      setCurrentGeneratingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* TOP BAR: Search & Filters */}
      <div className="p-4 border-b bg-background">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs or companies..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Company */}
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-auto">
                <SelectItem value="all">All Companies</SelectItem>
                {companyOptions.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category */}
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-auto">
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Job Type */}
            <Select value={selectedJobType} onValueChange={setSelectedJobType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Job Type" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-auto">
                <SelectItem value="all">All Job Types</SelectItem>
                {jobTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Job list */}
        <div className="w-full md:w-1/3 border-r flex flex-col">
          <div
            ref={jobListRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {loading && paginatedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2Icon className="w-6 h-6 animate-spin mb-2" />
                <p>Loading jobs...</p>
              </div>
            ) : paginatedJobs.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">
                No jobs match your filters.
              </div>
            ) : (
              paginatedJobs.map((job) => (
                <Card
                  key={job.job_id}
                  className={`relative p-4 cursor-pointer transition border ${
                    selectedJob?.job_id === job.job_id
                      ? "border-blue-500"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleSelectJob(job)}
                >
                  {/* White dot if cover letter exists */}
                  {job.cover_letter && (
                    <div
                      className="absolute top-2 right-2 w-2.5 h-2.5 bg-white rounded-full shadow"
                      title="Cover letter generated"
                    />
                  )}
                  <h3 className="font-semibold">{job.job_title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {job.company_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {job.location} • {job.category}
                  </p>
                  <p className="text-xs mt-2">
                    Posted:{" "}
                    {format(new Date(job.created_at), "EEE, do MMM yyyy")}
                  </p>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="p-4 border-t flex justify-between items-center">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        {/* RIGHT: Job details */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedJob ? (
            <>
              <h2 className="text-2xl font-bold mb-2">
                {selectedJob.job_title}
              </h2>
              <p className="text-lg text-muted-foreground mb-4">
                {selectedJob.company_name}
              </p>

              <div className="mb-4 text-sm text-gray-600">
                <p>
                  <strong>Location:</strong> {selectedJob.location}
                </p>
                <p>
                  <strong>Category:</strong> {selectedJob.category}
                </p>
              </div>

              <p className="text-sm mb-2">
                Posted:{" "}
                <span className="font-medium">
                  {format(new Date(selectedJob.created_at), "EEE, do MMM yyyy")}
                </span>
              </p>

              {selectedJob.url && (
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline text-sm block mb-4"
                >
                  View Job Posting
                </a>
              )}

              {/* Description */}
              <div className="prose max-w-none mb-6 space-y-4">
                {selectedJob.description ? (
                  selectedJob.description
                    .split(/\n\s*\n/)
                    .map((paragraph, idx) => (
                      <p
                        key={idx}
                        className="whitespace-pre-wrap leading-relaxed"
                      >
                        {paragraph.trim()}
                      </p>
                    ))
                ) : (
                  <p className="text-muted-foreground">
                    No description available.
                  </p>
                )}
              </div>

              {/* Cover Letter Display */}
              {coverLetters.find((cl) => cl.job_id === selectedJob.job_id) ? (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Generated Cover Letter
                  </h3>
                  <pre className="p-4 bg-gray-100 dark:bg-gray-900 rounded text-sm whitespace-pre-wrap">
                    {
                      coverLetters.find(
                        (cl) => cl.job_id === selectedJob.job_id
                      )?.cover_letter
                    }
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  No cover letter generated yet.
                </p>
              )}

              {/* Action Button */}
              {coverLetters.find(
                (cl) => cl.job_id === selectedJob.job_id
              ) ? null : currentGeneratingId === selectedJob.job_id ? (
                <Button disabled>
                  <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </Button>
              ) : (
                <Button onClick={() => handleGenerateCoverLetter(selectedJob)}>
                  Generate Cover Letter
                </Button>
              )}
            </>
          ) : (
            <div className="text-muted-foreground flex items-center justify-center h-full">
              Select a job from the list to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
