"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Copy,
  RefreshCw,
  Search as SearchIcon,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

/* -----------------------------
   Types
----------------------------- */
interface Job {
  id: string;
  job_title: string;
  company_id: string;
  location: string;
  category: string;
  displayable: boolean;
}

interface Company {
  id: string;
  name: string;
}

interface Question {
  id: string;
  question: string;
  answer: string;
  loading: boolean;
  comment?: string;
}

interface ChatSession {
  id: string;
  job_id: string;
  created_at: string;
  updated_at: string;
  jobs: {
    job_title: string;
    companies: {
      name: string;
    };
  };
}

export default function Chatbot() {
  const supabase = createClient();

  const [step, setStep] = useState<"select" | "chat">("select");

  // Jobs, companies, categories, and locations
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  // Selection state
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [regenerateContext, setRegenerateContext] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);

  const [wordLimit, setWordLimit] = useState<number>(100); // Default to 100 words
  const [noLimit, setNoLimit] = useState<boolean>(false); // Checkbox toggle

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Regenerate dialog
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [regenerateQuestionId, setRegenerateQuestionId] = useState<
    string | null
  >(null);

  /* -------------------------
     Fetch Jobs & Companies
  -------------------------- */
  useEffect(() => {
    const fetchJobsAndCompanies = async () => {
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select("id, job_title, company_id, location, category, displayable")
        .eq("displayable", true)
        .order("created_at", { ascending: false });

      if (jobsError) {
        toast.error("Error fetching jobs");
        return;
      }
      setJobs(jobsData || []);

      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");

      if (companiesError) {
        toast.error("Error fetching companies");
        return;
      }
      setCompanies(companiesData || []);

      if (jobsData && jobsData.length > 0) {
        setCompanyOptions(
          [
            ...new Set(
              jobsData.map(
                (job) =>
                  companiesData.find((c) => c.id === job.company_id)?.name
              )
            ),
          ].filter(Boolean) as string[]
        );

        setCategoryOptions(
          [
            ...new Set(jobsData.map((job) => job.category || "Uncategorized")),
          ].sort()
        );

        const locations = jobsData
          .flatMap((job) =>
            job.location ? job.location.split(",").map((loc) => loc.trim()) : []
          )
          .filter(Boolean);

        setLocationOptions([...new Set(locations)].sort());
      }
    };

    fetchJobsAndCompanies();
  }, [supabase]);

  /* -------------------------
     Fetch Chat Sessions
  -------------------------- */
  const fetchChatSessions = async () => {
    // Optional: scope sessions by current user to avoid seeing others’ sessions
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const query = supabase
      .from("chat_sessions")
      .select(
        `id, job_id, created_at, updated_at,
         jobs(
           job_title,
           companies(name)
         )`
      )
      .order("updated_at", { ascending: false });

    if (user?.id) {
      // Only if you store user_id on chat_sessions (you do)
      query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching chat sessions:", error);
      toast.error("Failed to load chat sessions.");
      return;
    }

    setSessions(data || []);
  };

  useEffect(() => {
    fetchChatSessions();
  }, []);

  /* -------------------------
     Fetch Chat History (robust)
  -------------------------- */
  const fetchChatHistory = async (sessionId: string) => {
    // First, try the nested select (kept from your code)
    const { data, error } = await supabase
      .from("chat_inputs")
      .select(`id, question, comment, created_at, chat_outputs(answer)`)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    console.log(data);

    if (error) {
      console.error("Error fetching chat history:", error);
      toast.error("Failed to load chat history.");
      return;
    }

    let items: any[] = data || [];

    // If nested relation didn't return answers, fetch outputs in a second query and merge.
    const needsOutputFetch =
      !items ||
      items.length === 0 ||
      items.some((i) => !i.chat_outputs?.length);

    let outputMap = new Map<string, string>();
    if (needsOutputFetch && items.length > 0) {
      const inputIds = items.map((i) => i.id);
      console.log("input id", inputIds);
      const { data: outs, error: outsErr } = await supabase
        .from("chat_outputs")
        .select("id, answer")
        .in("id", inputIds);

      console.log("outs", outs);

      if (!outsErr && outs) {
        outs.forEach((o) => outputMap.set(o.id, o.answer));
      }
    }

    const formattedQuestions: Question[] = items.map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.chat_outputs?.[0]?.answer ?? outputMap.get(item.id) ?? "",
      loading: false,
      comment: item.comment || "",
    }));

    setQuestions(formattedQuestions);
  };

  // Also re-fetch history any time a new session becomes selected
  useEffect(() => {
    if (selectedSession?.id) {
      fetchChatHistory(selectedSession.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.id]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [questions]);

  /* -------------------------
     Create New Session (NO DB WRITE HERE)
  -------------------------- */
  const handleCreateSession = (job: Job) => {
    // Only store the selected job for now
    setSelectedJob(job);
    setSelectedSession(null); // reset any previous session
    setQuestions([]); // reset chat view for new job selection
    setStep("chat");
  };

  /* -------------------------
     Select Session
  -------------------------- */
  const handleSelectSession = async (session: ChatSession) => {
    setSelectedSession(session);
    setSelectedJob(jobs.find((j) => j.id === session.job_id) || null);
    setStep("chat");
    fetchChatHistory(session.id);
  };

  /* -------------------------
     Generate Answer
  -------------------------- */
  const handleGenerateAnswer = async (question: string, comment?: string) => {
    if (!selectedJob) {
      toast.error("Please select a job first.");
      return;
    }
    if (!question.trim()) return;

    let sessionId = selectedSession?.id;

    try {
      // Start loader when request begins
      setIsGenerating(true);

      // 1️⃣ Get logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error("You must be logged in to create a chat session.");
        setIsGenerating(false);
        return;
      }

      // 2️⃣ If no session exists yet, create it with user_id
      if (!sessionId) {
        const { data: newSession, error: sessionError } = await supabase
          .from("chat_sessions")
          .insert([{ job_id: selectedJob.id, user_id: user.id }])
          .select()
          .single();

        if (sessionError) throw new Error(sessionError.message);
        sessionId = newSession.id;
        setSelectedSession(newSession);
      }

      // 3️⃣ Add a loading state for the new question
      const tempId = crypto.randomUUID();
      setQuestions((prev) => [
        ...prev,
        { id: tempId, question, answer: "", loading: true, comment },
      ]);

      // 4️⃣ Send to API for generation
      const res = await fetch("/api/generate-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question,
          comment: comment || "",
          word_limit: noLimit ? null : wordLimit, // ✅ Add this
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate answer");

      // 5️⃣ Replace temp loading state with real answer
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === tempId ? { ...q, answer: data.answer, loading: false } : q
        )
      );

      // 6️⃣ Refresh sidebar now that a session exists & ensure persisted history syncs
      fetchChatSessions();
      if (sessionId) {
        fetchChatHistory(sessionId);
      }

      // clear input box
      setNewQuestion("");
    } catch (err: any) {
      console.error("Error generating answer:", err.message);
      toast.error(err.message || "Failed to generate answer");
    } finally {
      // Stop loader once process finishes
      setIsGenerating(false);
    }
  };

  /* -------------------------
     Regenerate Answer
  -------------------------- */
  const handleOpenRegenerate = (questionId: string) => {
    setRegenerateQuestionId(questionId);
    setRegenerateContext("");
    setIsRegenerateOpen(true);
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    if (!regenerateQuestionId || !selectedSession) return;

    const targetQuestion = questions.find((q) => q.id === regenerateQuestionId);
    if (!targetQuestion) return;

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === regenerateQuestionId ? { ...q, loading: true } : q
      )
    );

    await handleGenerateAnswer(targetQuestion.question, regenerateContext);

    setIsGenerating(false);

    // ✅ Close the dialog after regenerating
    setIsRegenerateOpen(false);

    // Optionally include word limit in the backend call
    console.log(
      "Regenerate with word limit:",
      noLimit ? "No limit" : wordLimit
    );
  };

  /* -------------------------
     UI
  -------------------------- */
  return (
    <div className="flex h-[calc(100vh-64px)] p-20">
      {/* Left Sidebar - Chat Sessions */}
      <div className="w-64 border-r h-full pr-4 space-y-4">
        <div className="space-y-2 max-h-[80vh] overflow-y-auto">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <Card
                key={session.id}
                className={`p-3 cursor-pointer hover:bg-muted ${
                  selectedSession?.id === session.id ? "bg-muted" : ""
                }`}
                onClick={() => handleSelectSession(session)}
              >
                <p className="font-medium">{session.jobs.job_title}</p>
                <p className="text-xs text-muted-foreground">
                  {session.jobs.companies.name}
                </p>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No sessions found.</p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 pl-4 flex flex-col h-full">
        {step === "select" && (
          <div className="flex items-center justify-center h-full">
            <Button onClick={() => setIsModalOpen(true)}>
              Start New Query
            </Button>
          </div>
        )}

        {step === "chat" && selectedJob && (
          <>
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {selectedJob?.job_title} -{" "}
                {companies.find((c) => c.id === selectedJob?.company_id)
                  ?.name || "Unknown Company"}
              </h2>
              <Button variant="outline" onClick={() => setStep("select")}>
                Back to Sessions
              </Button>
            </div>
            <Separator />

            {/* Chat History */}
            <div className="flex-1 flex flex-col overflow-hidden pt-4">
              {/* Chat history (scrollable) */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto pr-4 pb-4"
              >
                {questions.map((q) => (
                  <Card key={q.id} className="p-4 mb-4 last:mb-0">
                    <p className="font-semibold">Q: {q.question}</p>
                    {q.comment && (
                      <p className="text-xs text-muted-foreground">
                        Comment: {q.comment}
                      </p>
                    )}
                    {q.loading ? (
                      <div className="flex items-center mt-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating answer...
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="space-y-2">
                          {q.answer.split(/\n+/).map((paragraph, index) => (
                            <p key={index} className="text-sm">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigator.clipboard.writeText(q.answer)
                            }
                          >
                            <Copy className="h-4 w-4 mr-1" /> Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRegenerate(q.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Input Section (fixed at bottom) */}
              <Card className="p-4 flex-shrink-0 flex">
                <div className="flex gap-2 flex-col w-full">
                  <div className="w-full flex flex-row gap-2">
                    <Input
                      placeholder="Enter your next question..."
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !isGenerating &&
                        handleGenerateAnswer(newQuestion)
                      }
                    />
                    <Button
                      onClick={() => handleGenerateAnswer(newQuestion)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Submit"
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    {" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <label className="text-sm font-medium">
                        Word Limit:
                      </label>{" "}
                      <Input
                        type="number"
                        value={wordLimit}
                        onChange={(e) => setWordLimit(Number(e.target.value))}
                        disabled={noLimit}
                        className="w-20"
                        min={1}
                      />{" "}
                    </div>{" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <input
                        type="checkbox"
                        checked={noLimit}
                        onChange={() => setNoLimit(!noLimit)}
                        className="h-4 w-4"
                      />{" "}
                      <span className="text-sm">No Limit</span>{" "}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Modal for Job Selection */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[60%] w-full">
          <DialogHeader>
            <DialogTitle>Select a Job to Start</DialogTitle>
          </DialogHeader>

          {/* Filter Header */}
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
                  }}
                  className="pl-8"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                {/* Company Filter */}
                <Select
                  value={selectedCompany}
                  onValueChange={setSelectedCompany}
                >
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

          {/* Filtered Job Results */}
          <div className="max-h-80 overflow-y-auto space-y-2 p-4">
            {jobs
              .filter((job) => {
                const company = companies.find((c) => c.id === job.company_id);

                // Search filter
                const matchesSearch =
                  searchTerm.trim().length === 0 ||
                  job.job_title
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                  (company?.name.toLowerCase() || "").includes(
                    searchTerm.toLowerCase()
                  );

                // Company filter
                const matchesCompany =
                  selectedCompany !== "all"
                    ? company?.name === selectedCompany
                    : true;

                // Category filter
                const matchesCategory =
                  selectedCategories.length > 0
                    ? selectedCategories.includes(job.category)
                    : true;

                // Location filter
                const jobLocations = job.location
                  ? job.location
                      .split(",")
                      .map((loc) => loc.trim().toLowerCase())
                  : [];

                const matchesLocation =
                  selectedLocations.length > 0
                    ? selectedLocations.some((selected) =>
                        jobLocations.includes(selected.toLowerCase())
                      )
                    : true;

                return (
                  matchesSearch &&
                  matchesCompany &&
                  matchesCategory &&
                  matchesLocation
                );
              })
              .map((job) => {
                const company = companies.find((c) => c.id === job.company_id);
                return (
                  <Card
                    key={job.id}
                    className="p-3 cursor-pointer hover:bg-muted"
                    onClick={() => {
                      handleCreateSession(job);
                      setIsModalOpen(false);
                    }}
                  >
                    <p className="font-semibold">{job.job_title}</p>
                    <p className="text-sm text-muted-foreground">
                      {company?.name || "Unknown Company"}
                    </p>
                    {job.category && (
                      <p className="text-xs text-muted-foreground">
                        Category: {job.category}
                      </p>
                    )}
                  </Card>
                );
              })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Dialog */}
      <Dialog open={isRegenerateOpen} onOpenChange={setIsRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Answer</DialogTitle>
          </DialogHeader>

          {/* Context Textarea */}
          <Textarea
            placeholder="What would you like to mention or change?"
            value={regenerateContext}
            onChange={(e) => setRegenerateContext(e.target.value)}
          />

          {/* Word Limit Section */}
          <div className="flex items-center justify-between mt-4 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Word Limit</label>
              <Input
                type="number"
                value={wordLimit}
                onChange={(e) => setWordLimit(Number(e.target.value))}
                disabled={noLimit}
                className="w-32"
                min={1}
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={noLimit}
                onChange={() => setNoLimit(!noLimit)}
                className="h-4 w-4"
              />
              <span className="text-sm">No Limit</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRegenerateOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRegenerate}>Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
