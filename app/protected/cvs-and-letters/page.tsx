"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Card, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

  const [activeView, setActiveView] = useState<"cvs" | "letters">("letters");

  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        }));

        setCoverLetters(mapped);

        // Populate filter options
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
      } catch (err) {
        console.error(err);
        setError("Unable to load your cover letters right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchCoverLetters();
  }, [supabase]);

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
    <div className="flex flex-col w-full max-w-6xl mx-auto p-8 space-y-8 min-h-screen">
      {/* Header */}
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

      {/* Filters (Visible only for Cover Letters) */}
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

      {/* Main Content Area with Scrollable Inner Container */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2Icon className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center text-red-500 py-10">{error}</div>
        )}

        {!loading && !error && (
          <div className="h-[calc(100vh-300px)] overflow-auto px-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredCoverLetters.map((letter) => (
                  <Card
                    key={letter.id}
                    className="flex flex-col border shadow-md hover:shadow-lg transition-shadow p-0 overflow-hidden"
                  >
                    {/* Scrollable Cover Letter Area */}
                    <pre className="flex-1 text-sm leading-relaxed whitespace-pre-wrap p-6 max-h-[60vh] overflow-auto">
                      {letter.cover_letter || "No content available"}
                    </pre>

                    <Separator />

                    {/* Job Info */}
                    <CardFooter className="flex flex-col items-start p-4 space-y-2">
                      <div>
                        <h3 className="text-base font-semibold">
                          {letter.job_title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {letter.company_name}
                        </p>
                      </div>

                      <div className="w-full flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Created: {formatDate(letter.created_at)}
                          </p>
                          <Badge variant="secondary">{letter.category}</Badge>
                        </div>

                        {letter.url && (
                          <a
                            href={letter.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <ExternalLinkIcon className="h-4 w-4" />
                            Job
                          </a>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
