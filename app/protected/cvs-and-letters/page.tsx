"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation"; // ✅ For reading query parameters
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import {
  Loader2Icon,
  ExternalLinkIcon,
  FileTextIcon,
  ClipboardListIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/* ---------- Types ---------- */
interface CoverLetter {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  created_at: string;
  url?: string;
  cover_letter?: string;
  category?: string;
  location?: string;
  deadline?: string;
  description?: string;
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
    category: string | null;
    location: string | null;
    deadline: string | null;
    description: string | null;
    companies?: {
      name: string | null;
    } | null;
  } | null;
};

/* ---------- Utility ---------- */
const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "PPP");
};

export default function CVsAndLettersPage() {
  const supabase = createClient();
  const searchParams = useSearchParams(); // ✅ to get ?job_id= from URL
  const jobIdFromQuery = searchParams.get("job_id");

  const [activeView, setActiveView] = useState<"cvs" | "letters">("letters");

  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLetter, setSelectedLetter] = useState<CoverLetter | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  /* ---------- Filters ---------- */
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  /* ---------- Fetch Cover Letters ---------- */
  useEffect(() => {
    const fetchCoverLetters = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You need to be signed in to view this page.");
        setLoading(false);
        return;
      }

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
              category,
              location,
              deadline,
              description,
              companies!inner ( name )
            )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .returns<RawCoverLetterRow[]>();

        if (error) throw error;

        const mapped = (data || []).map<CoverLetter>((item) => ({
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
          category: item.jobs?.category ?? "Uncategorized",
          location: item.jobs?.location ?? "Not specified",
          deadline: item.jobs?.deadline ?? "No deadline",
          description: item.jobs?.description ?? "No description provided",
        }));

        setCoverLetters(mapped);

        // Populate filters
        setCompanyOptions(
          [...new Set(mapped.map((letter) => letter.company_name))].sort()
        );
        setCategoryOptions(
          [
            ...new Set(
              mapped.map((letter) => letter.category || "Uncategorized")
            ),
          ].sort()
        );
        setLocationOptions(
          [
            ...new Set(
              mapped.flatMap((letter) =>
                letter.location
                  ? letter.location.split(",").map((loc) => loc.trim())
                  : []
              )
            ),
          ].sort()
        );

        // ✅ Automatically open dialog if job_id matches
        if (jobIdFromQuery) {
          const foundLetter = mapped.find(
            (letter) => letter.job_id === jobIdFromQuery
          );
          if (foundLetter) {
            setSelectedLetter(foundLetter);
            setDialogOpen(true);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Unable to load your cover letters right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchCoverLetters();
  }, [supabase, jobIdFromQuery]);

  /* ---------- Filtering Logic ---------- */
  const filteredCoverLetters = useMemo(() => {
    return coverLetters.filter((letter) => {
      const matchesCompany =
        selectedCompany === "all" || letter.company_name === selectedCompany;

      const matchesCategory =
        selectedCategory === "all" || letter.category === selectedCategory;

      const jobLocations = letter.location
        ? letter.location.split(",").map((loc) => loc.trim().toLowerCase())
        : [];

      const matchesLocation =
        selectedLocation === "all" ||
        jobLocations.includes(selectedLocation.toLowerCase());

      return matchesCompany && matchesCategory && matchesLocation;
    });
  }, [coverLetters, selectedCompany, selectedCategory, selectedLocation]);

  /* ---------- UI ---------- */
  return (
    <div className="flex flex-col w-full h-[calc(100vh-64px)] max-h-[calc(100vh-80px)] overflow-hidden p-20">
      {/* Inner container */}
      <div className="w-full flex-1 max-h-full space-y-8 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">CVs & Letters</h1>

          {/* Toggle Buttons */}
          <div className="flex gap-4">
            <Button
              variant={activeView === "cvs" ? "default" : "outline"}
              onClick={() => setActiveView("cvs")}
              className="flex items-center gap-2"
            >
              <FileTextIcon className="w-4 h-4" />
              CVs
            </Button>
            <Button
              variant={activeView === "letters" ? "default" : "outline"}
              onClick={() => setActiveView("letters")}
              className="flex items-center gap-2"
            >
              <ClipboardListIcon className="w-4 h-4" />
              Cover Letters
            </Button>
          </div>
        </div>

        {/* Filters - Only show when viewing letters */}
        {activeView === "letters" && (
          <div className="flex flex-wrap gap-4">
            {/* Company Filter */}
            <Select
              value={selectedCompany}
              onValueChange={(value) => setSelectedCompany(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companyOptions.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location Filter */}
            <Select
              value={selectedLocation}
              onValueChange={(value) => setSelectedLocation(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationOptions.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator />

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto px-4">
          {loading && (
            <div className="flex justify-center items-center py-20">
              <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center text-red-500 py-10">{error}</div>
          )}

          {!loading && !error && (
            <>
              {activeView === "cvs" ? (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="text-lg">
                    CV management coming soon. Upload and manage your CVs here.
                  </p>
                </div>
              ) : filteredCoverLetters.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <p>No cover letters match your selected filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredCoverLetters.map((letter) => (
                    <Card
                      key={letter.id}
                      onClick={() => {
                        setSelectedLetter(letter);
                        setDialogOpen(true);
                      }}
                      className="cursor-pointer p-4 border shadow-sm hover:shadow-lg transition-shadow"
                    >
                      <h3 className="text-lg font-semibold">
                        {letter.job_title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {letter.company_name}
                      </p>
                      <div className="mt-2 flex justify-between items-center">
                        <Badge variant="secondary">{letter.category}</Badge>
                        <p className="text-xs text-gray-500">
                          Deadline: {formatDate(letter.deadline)}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[88%] w-full p-0 overflow-hidden">
            {selectedLetter && (
              <div className="h-[80vh] overflow-y-auto">
                {/* Side-by-side grid with unified scroll */}
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {/* Cover Letter Side */}
                  <div className="p-6 border-r">
                    <DialogHeader>
                      <DialogTitle>Cover Letter</DialogTitle>
                      <DialogDescription>
                        for {selectedLetter.job_title} at{" "}
                        {selectedLetter.company_name}
                      </DialogDescription>
                    </DialogHeader>
                    <Separator className="my-4" />
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedLetter.cover_letter ||
                        "No cover letter available"}
                    </pre>
                  </div>

                  {/* Job Info Side */}
                  <div className="p-6">
                    {/* Job Header */}
                    <div className="mb-4">
                      <h2 className="text-2xl font-bold">
                        {selectedLetter.job_title}
                      </h2>
                      <p className="text-lg text-muted-foreground mt-2">
                        {selectedLetter.company_name}
                      </p>
                    </div>

                    <div className="mb-4 text-sm text-gray-600">
                      <p>
                        <strong>Location:</strong> {selectedLetter.location}
                      </p>
                      <p>
                        <strong>Category:</strong> {selectedLetter.category}
                      </p>
                    </div>

                    <p className="text-sm mb-4">
                      Posted:{" "}
                      <span className="font-medium">
                        {format(
                          new Date(selectedLetter.created_at),
                          "EEE, do MMM yyyy"
                        )}
                      </span>
                    </p>

                    {selectedLetter.url && (
                      <a
                        href={selectedLetter.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline text-sm block mb-4"
                      >
                        View Job Posting
                      </a>
                    )}

                    <Separator className="my-4" />

                    {/* Job Description */}
                    <h4 className="text-md font-medium mb-2">
                      Job Description
                    </h4>
                    <div className="prose max-w-none space-y-4">
                      {selectedLetter.description
                        ? selectedLetter.description
                            .split(/\n\s*\n/)
                            .map((block, idx) => {
                              const lines = block
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean);

                              const hasBullets = lines.some((l) =>
                                /^-\s+/.test(l)
                              );
                              const boldify = (s: string) =>
                                s.replace(
                                  /\*\*(.*?)\*\*/g,
                                  "<strong>$1</strong>"
                                );

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
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
