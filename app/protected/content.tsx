"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
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
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";

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
  salary?: string;
  deadline?: Date;
  logo?: string;
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
  const router = useRouter();

  const [allJobs, setAllJobs] = useState<UnifiedCoverLetter[]>([]);
  const [selectedJob, setSelectedJob] = useState<UnifiedCoverLetter | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [currentGeneratingId, setCurrentGeneratingId] = useState<string | null>(
    null
  );

  const [coverLetters, setCoverLetters] = useState<interfaceCoverLetter[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null); // NEW: Track authenticated user
  const [checkingUser, setCheckingUser] = useState(true); // NEW: Track loading state

  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [userChecked, setUserChecked] = useState(false);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const jobListRef = useRef<HTMLDivElement | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  // Options for dropdowns
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  /**
   * Fetch jobs, companies, cover letters, and saved jobs
   */
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);

      let letters = [];
      let tracking = [];

      // Only fetch cover letters & saved jobs if logged in
      if (user) {
        const { data: coverLettersData } = await supabase
          .from("cover_letters")
          .select("*")
          .eq("user_id", user.id);

        letters = coverLettersData || [];

        const { data: trackingData } = await supabase
          .from("tracking")
          .select("job_id")
          .eq("user_id", user.id);

        tracking = trackingData || [];
        setCoverLetters(letters);
        setSavedJobs(tracking.map((t) => t.job_id));
      } else {
        setCoverLetters([]);
        setSavedJobs([]);
      }

      const today = new Date().toISOString();
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("*")
        .or(`deadline.gte.${today},deadline.is.null`)
        .order("created_at", { ascending: false })
        .eq("ready", true);

      if (jobsError) throw jobsError;

      // Fetch companies
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name");
      // .eq("new", true);

      const companyMap = (companies || []).reduce<Record<string, string>>(
        (acc, c) => {
          acc[c.id] = c.name;
          return acc;
        },
        {}
      );

      // Merge jobs
      const unified: UnifiedCoverLetter[] = (jobs || []).map((job) => {
        const jobCoverLetter = letters.find(
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
          salary: job.salary,
          deadline: job.deadline,
          logo: job.logo,
        };
      });

      setAllJobs(unified);

      // Filter dropdowns
      setCompanyOptions(
        [...new Set(unified.map((j) => j.company_name))].sort()
      );
      // Inside fetchJobs(), after setAllJobs(unified)
      const allCategories = unified.flatMap((j) =>
        j.category ? j.category.split(",").map((c) => c.trim()) : []
      );

      setCategoryOptions([...new Set(allCategories)].sort());

      const allLocations = unified
        .flatMap((job) =>
          job.location ? job.location.split(",").map((loc) => loc.trim()) : []
        )
        .filter(Boolean);

      setLocationOptions([...new Set(allLocations)].sort());

      if (unified.length > 0 && !selectedJob) {
        setSelectedJob(unified[0]);
      }
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      toast.error(`Error fetching jobs: ${error?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [supabase, user, selectedJob]);

  const promptSignUp = () => {
    toast.error("Please create an account to use this feature.");
  };

  /**
   * Fetch user_information to determine missing fields
   */
  const fetchUserInformation = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      const { data, error } = await supabase
        .from("user_information")
        .select(
          "technical_skills, soft_skills, extra_curriculars, personal_projects"
        )
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        toast.error("Error fetching profile information");
        console.error(error);
        return;
      }

      const fields = [
        { key: "technical_skills", label: "Technical Skills" },
        { key: "soft_skills", label: "Soft Skills" },
        { key: "extra_curriculars", label: "Extra Curriculars" },
        { key: "personal_projects", label: "Personal Projects" },
      ];

      const missing = fields
        .filter((f) => !data || !data[f.key] || data[f.key].trim() === "")
        .map((f) => f.label);

      setMissingFields(missing);
    } catch (err) {
      console.error("Error fetching user information:", err);
    } finally {
      setUserChecked(true);
    }
  }, [supabase]);

  useEffect(() => {
    const fetchUser = async () => {
      setCheckingUser(true);

      const { data, error } = await supabase.auth.getUser();

      if (error?.message === "Auth session missing!") {
        // This just means no one is logged in — not a true error
        setUser(null);
      } else if (error) {
        // Other unexpected auth errors
        console.error("Unexpected auth error:", error.message);
      } else {
        setUser(data.user);
      }

      setCheckingUser(false);
    };

    fetchUser();
  }, [supabase]);

  useEffect(() => {
    fetchUserInformation();
  }, [fetchUserInformation]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Scroll to top on page change
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

      const jobCategories = job.category
        ? job.category.split(",").map((c) => c.trim())
        : [];

      const matchesCategory =
        selectedCategories.length > 0
          ? jobCategories.some((c) => selectedCategories.includes(c))
          : true;

      const jobLocations = job.location
        ? job.location.split(",").map((loc) => loc.trim().toLowerCase())
        : [];

      const matchesLocation =
        selectedLocations.length > 0
          ? selectedLocations.some((selected) =>
              jobLocations.includes(selected.toLowerCase())
            )
          : true;

      return (
        matchesSearch && matchesCompany && matchesCategory && matchesLocation
      );
    });
  }, [
    allJobs,
    searchTerm,
    selectedCompany,
    selectedCategories,
    selectedLocations,
  ]);

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredJobs.slice(start, start + PAGE_SIZE);
  }, [filteredJobs, page]);

  const totalPages = Math.ceil(filteredJobs.length / PAGE_SIZE);

  const handleSelectJob = (job: UnifiedCoverLetter) => {
    setSelectedJob(job);
  };

  /**
   * Generate Cover Letter Button
   * Disabled if user information is incomplete
   */

  const renderGenerateCoverLetterButton = (job: UnifiedCoverLetter) => {
    if (!user) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-not-allowed">
              <Button
                className="pointer-events-none opacity-50"
                variant="outline"
              >
                Generate Cover Letter
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Please sign up to generate cover letters</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    // existing missing fields logic
    const isDisabled = missingFields.length > 0;

    const button = (
      <div className={isDisabled ? "cursor-not-allowed" : ""}>
        <Button
          variant="outline"
          className={isDisabled ? "pointer-events-none opacity-50" : ""}
          onClick={() => !isDisabled && handleGenerateCoverLetter(job)}
        >
          {currentGeneratingId === job.job_id ? (
            <>
              <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Cover Letter"
          )}
        </Button>
      </div>
    );

    if (!isDisabled) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>
            Cannot generate cover letter. Please fill out the following fields
            in your profile:
          </p>
          <p className="mt-1 text-red-500 font-medium">
            {missingFields.join(", ")}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const handleGenerateCoverLetter = async (job: UnifiedCoverLetter) => {
    setLoading(true);
    setCurrentGeneratingId(job.job_id);
    toast.info("Cover letter generation takes about ~1 min");

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
      console.log(result);
      if (!result.success) {
        toast.error(`Error generating cover letter for ${job.job_title}`);
      } else {
        toast.success(`Cover letter generated for ${job.job_title}`);
        await fetchJobs();
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong while generating cover letter");
    } finally {
      setLoading(false);
      setCurrentGeneratingId(null);
    }
  };

  const handleToggleSaveJob = async (job: UnifiedCoverLetter) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      toast.error("You must be logged in to manage saved jobs.");
      return;
    }

    if (savedJobs.includes(job.job_id)) {
      const { error } = await supabase
        .from("tracking")
        .delete()
        .eq("user_id", user.id)
        .eq("job_id", job.job_id);

      if (error) {
        toast.error("Failed to unsave job.");
        return;
      }

      toast.success(`${job.job_title} removed from saved jobs.`);
      setSavedJobs((prev) => prev.filter((id) => id !== job.job_id));
    } else {
      const { error } = await supabase.from("tracking").insert([
        {
          user_id: user.id,
          job_id: job.job_id,
          status: "Not Applied",
          auto_favourite: false,
        },
      ]);

      if (error) {
        toast.error("Failed to save job.");
        return;
      }

      toast.success(`${job.job_title} saved successfully!`);
      setSavedJobs((prev) => [...prev, job.job_id]);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Bar: Search & Filters */}
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
            {/* Company Filter */}
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Company" />
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

            {/* Multi-Select Categories */}
            <Select
              value={selectedCategories.join(",")}
              onValueChange={() => {}}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by Category">
                  {selectedCategories.length > 0
                    ? `${selectedCategories.length} selected`
                    : "All Categories"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-auto">
                {categoryOptions.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategories((prev) =>
                        prev.includes(cat)
                          ? prev.filter((c) => c !== cat)
                          : [...prev, cat]
                      );
                      setPage(1);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      readOnly
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{cat}</span>
                  </div>
                ))}
              </SelectContent>
            </Select>

            {/* Multi-Select Locations */}
            <Select
              value={selectedLocations.join(",")}
              onValueChange={() => {}}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by Location">
                  {selectedLocations.length > 0
                    ? `${selectedLocations.length} selected`
                    : "All Locations"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-auto">
                {locationOptions.map((loc) => (
                  <div
                    key={loc}
                    className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLocations((prev) =>
                        prev.includes(loc)
                          ? prev.filter((l) => l !== loc)
                          : [...prev, loc]
                      );
                      setPage(1);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(loc)}
                      readOnly
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{loc}</span>
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Job List */}
        <div className="w-full md:w-1/4 border-r flex flex-col">
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
                  className={`relative p-[1px] rounded-lg transition-all duration-300 ${
                    selectedJob?.job_id === job.job_id
                      ? "bg-gradient-to-r from-blue-500 to-purple-600"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleSelectJob(job)}
                >
                  <div className="w-full h-full flex flex-col"></div>
                  {savedJobs.includes(job.job_id) && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full shadow" />
                  )}

                  <div className="flex flex-row pt-4 px-4 bg-background rounded-t-lg gap-2 items-center">
                    <Image
                      src={job.logo}
                      alt={job.company_name}
                      width={46} // pick a sensible default
                      height={46}
                      className="object-contain rounded-md bg-white border"
                    />

                    <h3 className="text-sm font-medium text-gray-500">
                      {job.company_name}
                    </h3>
                  </div>

                  <div className="flex flex-col space-y-2 bg-background transition-all duration-300 cursor-pointer rounded-b-lg p-4">
                    {/* Job Title */}
                    <h3 className="font-semibold text-base">{job.job_title}</h3>

                    {/* Location & Category */}
                    <p className="text-sm text-gray-700">
                      {(() => {
                        if (!job?.location) return "Not specified";

                        const parts = job.location
                          .split(",")
                          .map((p) => p.trim());

                        // If it's exactly "United Kingdom"
                        if (
                          parts.length === 1 &&
                          parts[0] === "United Kingdom"
                        ) {
                          return "United Kingdom";
                        }

                        // Otherwise, return only the city/town names (everything before regions and country)
                        // Heuristic: locations usually alternate City, Region, Country
                        // So take only the first half until "United Kingdom"
                        const withoutCountry = parts.filter(
                          (p) => p !== "United Kingdom"
                        );
                        const cityCandidates = withoutCountry.slice(
                          0,
                          Math.ceil(withoutCountry.length / 2)
                        );

                        return cityCandidates.join(", ");
                      })()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {job.category || "Uncategorized"}
                    </p>

                    {/* Salary - More pronounced */}
                    <p className="text-sm font-bold text-primary">
                      {job.salary ? `${job.salary}` : "Salary: N/A"}
                    </p>

                    {/* Deadline */}
                    <p className="text-sm text-gray-600">
                      Deadline:{" "}
                      {job.deadline
                        ? format(new Date(job.deadline), "EEE, do MMM yyyy")
                        : "No Deadline"}
                    </p>
                  </div>
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

        {/* RIGHT: Job Details */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedJob ? (
            <>
              {/* Job Title and Actions */}
              <div className="flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                  {/* Job Title and Company */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold break-words">
                      {selectedJob.job_title}
                    </h2>

                    <p className="text-sm text-muted-foreground break-words">
                      {selectedJob.company_name}
                    </p>
                  </div>

                  {/* Action Buttons - Always top right */}
                  <div className="flex-shrink-0 flex gap-2">
                    {coverLetters.find(
                      (cl) => cl.job_id === selectedJob.job_id
                    ) ? (
                      <Button
                        onClick={() =>
                          router.push(
                            `/protected/cvs-and-letters?job_id=${selectedJob.id}`
                          )
                        }
                      >
                        View Cover Letter
                      </Button>
                    ) : (
                      renderGenerateCoverLetterButton(selectedJob)
                    )}

                    {savedJobs.includes(selectedJob.job_id) ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          user
                            ? handleToggleSaveJob(selectedJob)
                            : promptSignUp()
                        }
                        className="px-4"
                      >
                        Unsave
                      </Button>
                    ) : (
                      <Button
                        onClick={() =>
                          user
                            ? handleToggleSaveJob(selectedJob)
                            : promptSignUp()
                        }
                      >
                        Save
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Sleek Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start my-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">
                      {(() => {
                        if (!selectedJob.location) return "Not specified";

                        const parts = selectedJob.location
                          .split(",")
                          .map((p) => p.trim());

                        // If it's exactly "United Kingdom"
                        if (
                          parts.length === 1 &&
                          parts[0] === "United Kingdom"
                        ) {
                          return "United Kingdom";
                        }

                        // Otherwise, return only the city/town names (everything before regions and country)
                        // Heuristic: locations usually alternate City, Region, Country
                        // So take only the first half until "United Kingdom"
                        const withoutCountry = parts.filter(
                          (p) => p !== "United Kingdom"
                        );
                        const cityCandidates = withoutCountry.slice(
                          0,
                          Math.ceil(withoutCountry.length / 2)
                        );

                        return cityCandidates.join(", ");
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-medium">
                      {selectedJob.category || "Uncategorized"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Salary</p>
                    <p className="font-medium">{selectedJob.salary || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <p
                      className={`font-medium ${
                        selectedJob.deadline &&
                        new Date(selectedJob.deadline).getTime() - Date.now() <
                          7 * 24 * 60 * 60 * 1000 &&
                        "text-red-600"
                      }`}
                    >
                      {selectedJob.deadline
                        ? format(
                            new Date(selectedJob.deadline),
                            "EEE, do MMM yyyy"
                          )
                        : "No Deadline"}
                    </p>
                  </div>
                </div>

                <Separator className="mb-4" />

                <div className="w-full mb-4">
                  {selectedJob.url && (
                    <a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:opacity-90 transition max-w-40"
                    >
                      Apply now
                    </a>
                  )}
                </div>

                <Separator className="mb-4" />

                <div className="prose max-w-none space-y-4">
                  {selectedJob.description
                    ? selectedJob.description
                        .split(/\n\s*\n/)
                        .map((block, idx) => {
                          const lines = block
                            .split("\n")
                            .map((l) => l.trim())
                            .filter(
                              (l) => l && l !== "---" // 🚀 ignore empty and --- separator lines
                            );

                          const hasBullets = lines.some((l) => /^-\s+/.test(l));
                          const boldify = (s: string) =>
                            s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

                          if (hasBullets) {
                            const headingLines = lines.filter(
                              (l) => !/^- /.test(l)
                            );
                            const bulletLines = lines
                              .filter((l) => /^- /.test(l))
                              .map((l) => l.replace(/^- /, ""));

                            return (
                              <div key={idx} className="space-y-2">
                                {headingLines.length > 0 && (
                                  <div
                                    className="text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                      __html: boldify(
                                        headingLines.join("<br/>")
                                      ),
                                    }}
                                  />
                                )}
                                <ul className="list-disc space-y-1 text-sm ml-6">
                                  {bulletLines.map((li, i) => (
                                    <li
                                      key={i}
                                      dangerouslySetInnerHTML={{
                                        __html: boldify(li),
                                      }}
                                    />
                                  ))}
                                </ul>
                              </div>
                            );
                          } else {
                            const html = boldify(lines.join("\n"));
                            return (
                              <div
                                key={idx}
                                className="whitespace-pre-wrap leading-relaxed text-sm"
                                dangerouslySetInnerHTML={{ __html: html }}
                              />
                            );
                          }
                        })
                    : "No description available."}
                </div>
              </div>
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
