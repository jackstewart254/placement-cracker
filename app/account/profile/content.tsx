"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

/* ----------------------------------------------
   Types
---------------------------------------------- */
interface IndividualInformation {
  user_id: string;
  full_name: string;
  university: string;
  year_of_study: string;
  degree: string;
}

interface UserInformation {
  technical_skills: string;
  soft_skills: string;
  extra_curriculars: string; // JSON string
  personal_projects: string; // JSON string
}

/* ----------------------------------------------
   Main ProfilePage Component
---------------------------------------------- */
export default function ProfilePage() {
  const supabase = createClient();

  /* ----------------------------------------------
     State for Personal Information
  ---------------------------------------------- */
  const [personalInfo, setPersonalInfo] = useState<IndividualInformation>({
    user_id: "",
    full_name: "",
    university: "",
    year_of_study: "",
    degree: "",
  });
  const [originalPersonalInfo, setOriginalPersonalInfo] =
    useState<IndividualInformation | null>(null);

  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [hasPersonalRecord, setHasPersonalRecord] = useState(false);
  const [isDirtyPersonal, setIsDirtyPersonal] = useState(false);

  const [personalErrors, setPersonalErrors] = useState({
    full_name: "",
    university: "",
    year_of_study: "",
    degree: "",
  });

  // Regex
  const nameRegex = /^([A-Za-z]{2,})(\s[A-Za-z]{2,})+$/;
  const yearRegex = /^[1-9]\d*$/;
  const degreeRegex =
    /^(BSc|BA|BEng|LLB|BEd|BFA|BMus|BNurs|BPhil|BVetMed|BVSc|MSc|MA|MEng|LLM|MBA|MEd|MFA|MMus|MPH|MRes|PhD|DPhil|EdD|EngD|MD|DDS|DMD)\b/i;

  /* ----------------------------------------------
     State for Meta Information
  ---------------------------------------------- */
  const [metaInfo, setMetaInfo] = useState<UserInformation>({
    technical_skills: "",
    soft_skills: "",
    extra_curriculars: "[]",
    personal_projects: "[]",
  });

  const [originalMetaInfo, setOriginalMetaInfo] =
    useState<UserInformation | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [isDirtyMeta, setIsDirtyMeta] = useState(false);

  const [metaErrors, setMetaErrors] = useState({
    technical_skills: "",
    soft_skills: "",
  });

  /* ----------------------------------------------
     Refs for Auto-Resize
  ---------------------------------------------- */
  const technicalSkillsRef = useRef<HTMLTextAreaElement | null>(null);
  const softSkillsRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = (element: HTMLTextAreaElement) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  /* ----------------------------------------------
     Validation Handlers
  ---------------------------------------------- */
  const validatePersonalField = (
    field: keyof IndividualInformation,
    value: string
  ) => {
    let errorMessage = "";

    if (field === "full_name" && !nameRegex.test(value)) {
      errorMessage =
        "Full name must include first and last name, each at least 2 letters.";
    }
    if (field === "year_of_study" && !yearRegex.test(value)) {
      errorMessage = "Year of study must be a positive number greater than 0.";
    }
    if (field === "degree" && !degreeRegex.test(value)) {
      errorMessage = "Degree must start with BSc, BA, MSc, MA, PhD, or MBA.";
    }

    setPersonalErrors((prev) => ({ ...prev, [field]: errorMessage }));
  };

  const regexRules = {
    technical_skills: /^([A-Za-z0-9\s.+/()\-]+)(,\s*[A-Za-z0-9\s.+/()\-]+)*$/,
    soft_skills: /^([A-Za-z\s\-.]+)(,\s*[A-Za-z\s\-.]+)*$/,
  };

  const validateMetaField = (field: keyof UserInformation, value: string) => {
    let errorMessage = "";
    if (regexRules[field] && !regexRules[field].test(value)) {
      errorMessage =
        field === "technical_skills"
          ? "Technical skills must be comma-separated (e.g., JavaScript, CSS, HTML)."
          : "Soft skills must be comma-separated (e.g., Communication, Teamwork).";
    }
    setMetaErrors((prev) => ({ ...prev, [field]: errorMessage }));
    return errorMessage === "";
  };

  /* ----------------------------------------------
     Fetch Data on Mount
  ---------------------------------------------- */
  useEffect(() => {
    const fetchData = async () => {
      /* ---------- PERSONAL ---------- */
      setLoadingPersonal(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Error fetching user:", userError?.message);
        setLoadingPersonal(false);
        return;
      }

      const { data: personalData, error: personalError } = await supabase
        .from("individual_information")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (personalError && personalError.code !== "PGRST116") {
        console.error("Error fetching personal info:", personalError.message);
      }

      if (personalData) {
        setPersonalInfo(personalData);
        setOriginalPersonalInfo(personalData);
        setHasPersonalRecord(true);
      } else {
        const initialData = { ...personalInfo, user_id: user.id };
        setPersonalInfo(initialData);
        setOriginalPersonalInfo(initialData);
        setHasPersonalRecord(false);
      }
      setLoadingPersonal(false);

      /* ---------- META ---------- */
      setLoadingMeta(true);

      const { data: metaData, error: metaError } = await supabase
        .from("user_information")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (metaError && metaError.code !== "PGRST116") {
        console.error("Error fetching meta info:", metaError.message);
      }

      const loadedMeta = metaData || {
        technical_skills: "",
        soft_skills: "",
        extra_curriculars: "[]",
        personal_projects: "[]",
      };

      setMetaInfo(loadedMeta);
      setOriginalMetaInfo(loadedMeta);
      setLoadingMeta(false);
    };

    fetchData();
  }, [supabase]);

  /* ----------------------------------------------
     Auto Resize Effect for Textareas
  ---------------------------------------------- */
  useEffect(() => {
    if (technicalSkillsRef.current) autoResize(technicalSkillsRef.current);
    if (softSkillsRef.current) autoResize(softSkillsRef.current);
  }, [metaInfo]);

  /* ----------------------------------------------
     Handlers for Personal Info
  ---------------------------------------------- */
  const handlePersonalChange = (
    field: keyof IndividualInformation,
    value: string
  ) => {
    const updated = { ...personalInfo, [field]: value };
    setPersonalInfo(updated);
    setIsDirtyPersonal(
      JSON.stringify(updated) !== JSON.stringify(originalPersonalInfo)
    );
    validatePersonalField(field, value);
  };

  const savePersonalInfo = async () => {
    setLoadingPersonal(true);
    if (!personalInfo.user_id) {
      console.error("Cannot save without a valid user_id");
      setLoadingPersonal(false);
      return;
    }

    try {
      const savePayload = {
        user_id: personalInfo.user_id,
        full_name: personalInfo.full_name,
        university: personalInfo.university,
        year_of_study: Number(personalInfo.year_of_study),
        degree: personalInfo.degree,
      };

      const { error } = await supabase
        .from("individual_information")
        .upsert([savePayload]);
      if (error) throw error;

      setOriginalPersonalInfo(personalInfo);
      setIsDirtyPersonal(false);
      alert(
        hasPersonalRecord
          ? "Information updated successfully!"
          : "Information saved successfully!"
      );
      setHasPersonalRecord(true);
    } catch (err) {
      console.error("Error saving personal information:", err);
      alert(
        "There was an error saving your personal information. Please try again."
      );
    }

    setLoadingPersonal(false);
  };

  /* ----------------------------------------------
     Handlers for Meta Info
  ---------------------------------------------- */
  const handleMetaChange = (
    field: keyof UserInformation,
    value: string,
    element?: HTMLTextAreaElement
  ) => {
    const updated = { ...metaInfo, [field]: value };
    setMetaInfo(updated);
    if (element) autoResize(element);
    setIsDirtyMeta(
      JSON.stringify(updated) !== JSON.stringify(originalMetaInfo)
    );
    if (field === "technical_skills" || field === "soft_skills") {
      validateMetaField(field, value);
    }
  };

  const saveMetaInfo = async () => {
    setLoadingMeta(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error fetching user for save:", userError?.message);
      setLoadingMeta(false);
      return;
    }

    const isValid = (Object.keys(metaInfo) as (keyof UserInformation)[]).every(
      (field) =>
        field === "extra_curriculars" || field === "personal_projects"
          ? true
          : validateMetaField(field, metaInfo[field])
    );

    if (!isValid) {
      alert("Please fix validation errors before saving.");
      setLoadingMeta(false);
      return;
    }

    try {
      const { error } = await supabase.from("user_information").upsert([
        {
          ...metaInfo,
          user_id: user.id,
        },
      ]);

      if (error) throw error;
      setOriginalMetaInfo(metaInfo);
      setIsDirtyMeta(false);
      alert("Meta information saved successfully!");
    } catch (err) {
      console.error("Error saving meta information:", err);
      alert("There was an error saving your information. Please try again.");
    }

    setLoadingMeta(false);
  };

  /* ----------------------------------------------
     Helpers for Extra Curriculars and Projects
  ---------------------------------------------- */
  const parsedExtraCurriculars = JSON.parse(
    metaInfo.extra_curriculars || "[]"
  ) as {
    title: string;
    description: string;
  }[];

  const parsedPersonalProjects = JSON.parse(
    metaInfo.personal_projects || "[]"
  ) as {
    title: string;
    description: string;
  }[];

  const addItem = (
    field: "extra_curriculars" | "personal_projects",
    title: string,
    description: string
  ) => {
    const list =
      field === "extra_curriculars"
        ? parsedExtraCurriculars
        : parsedPersonalProjects;
    const updated = [...list, { title, description }];
    handleMetaChange(field, JSON.stringify(updated));
  };

  const removeItem = (
    field: "extra_curriculars" | "personal_projects",
    index: number
  ) => {
    const list =
      field === "extra_curriculars"
        ? parsedExtraCurriculars
        : parsedPersonalProjects;
    const updated = list.filter((_, i) => i !== index);
    handleMetaChange(field, JSON.stringify(updated));
  };

  /* ----------------------------------------------
     UI
  ---------------------------------------------- */
  return (
    <div className="flex flex-col gap-6 md:p-20 p-4 w-full">
      <h1 className="font-bold text-3xl mb-6">Profile</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Manage your personal and relevant information here to include it in your
        applications automatically.
      </p>

      <Accordion type="single" collapsible className="w-full">
        {/* -------- Personal Information Section -------- */}
        <AccordionItem value="1" className="border-b">
          <AccordionTrigger className="text-lg font-medium">
            Personal Information
          </AccordionTrigger>
          <AccordionContent
            className="
    overflow-hidden 
    transition-all duration-300 ease-in-out 
    data-[state=closed]:animate-accordion-up 
    data-[state=open]:animate-accordion-down
  "
          >
            <div className="pt-4 flex flex-col gap-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Keep your personal details up to date so they can be
                automatically included in your applications.
              </p>

              <Input
                type="text"
                placeholder="Full Name"
                value={personalInfo.full_name}
                onChange={(e) =>
                  handlePersonalChange("full_name", e.target.value)
                }
                className={personalErrors.full_name ? "border-red-500" : ""}
              />
              {personalErrors.full_name && (
                <p className="text-red-500 text-xs">
                  {personalErrors.full_name}
                </p>
              )}

              <Input
                type="text"
                placeholder="University"
                value={personalInfo.university}
                onChange={(e) =>
                  handlePersonalChange("university", e.target.value)
                }
              />

              <Input
                type="number"
                placeholder="Year of Study"
                value={personalInfo.year_of_study}
                onChange={(e) =>
                  handlePersonalChange("year_of_study", e.target.value)
                }
                className={personalErrors.year_of_study ? "border-red-500" : ""}
              />
              {personalErrors.year_of_study && (
                <p className="text-red-500 text-xs">
                  {personalErrors.year_of_study}
                </p>
              )}

              <Input
                type="text"
                placeholder="Degree e.g. BSc Computer Science Hons"
                value={personalInfo.degree}
                onChange={(e) => handlePersonalChange("degree", e.target.value)}
                className={personalErrors.degree ? "border-red-500" : ""}
              />
              {personalErrors.degree && (
                <p className="text-red-500 text-xs">{personalErrors.degree}</p>
              )}

              {isDirtyPersonal && (
                <Button
                  onClick={savePersonalInfo}
                  disabled={
                    loadingPersonal ||
                    Object.values(personalErrors).some((err) => err !== "")
                  }
                  className="bg-green-500 hover:bg-green-600 text-white self-start"
                >
                  {loadingPersonal ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* -------- Meta Information Section -------- */}
        <AccordionItem value="2" className="border-b">
          <AccordionTrigger className="text-lg font-medium">
            Relevant Information
          </AccordionTrigger>
          <AccordionContent
            className="
    overflow-hidden 
    transition-all duration-300 ease-in-out 
    data-[state=closed]:animate-accordion-up 
    data-[state=open]:animate-accordion-down
  "
          >
            <div className="pt-4 flex flex-col gap-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Enter comma-separated values for each category below, except{" "}
                <strong>Personal Projects</strong>, where you should use
                paragraph formatting.
              </p>

              {/* Technical Skills */}
              <Textarea
                ref={technicalSkillsRef}
                placeholder="Technical Skills (comma-separated)"
                value={metaInfo.technical_skills}
                onInput={(e) =>
                  handleMetaChange(
                    "technical_skills",
                    e.currentTarget.value,
                    e.currentTarget
                  )
                }
                className={metaErrors.technical_skills ? "border-red-500" : ""}
              />
              {metaErrors.technical_skills && (
                <p className="text-red-500 text-xs">
                  {metaErrors.technical_skills}
                </p>
              )}

              {/* Soft Skills */}
              <Textarea
                ref={softSkillsRef}
                placeholder="Soft Skills (comma-separated)"
                value={metaInfo.soft_skills}
                onInput={(e) =>
                  handleMetaChange(
                    "soft_skills",
                    e.currentTarget.value,
                    e.currentTarget
                  )
                }
                className={metaErrors.soft_skills ? "border-red-500" : ""}
              />
              {metaErrors.soft_skills && (
                <p className="text-red-500 text-xs">{metaErrors.soft_skills}</p>
              )}

              <Separator />

              {/* Extra Curriculars */}
              <h3 className="font-semibold text-lg mb-2">
                Extra Curricular Activities
              </h3>
              <div className="space-y-2 mb-4">
                <Input id="extraTitle" placeholder="Activity Title" />
                <Textarea
                  id="extraDescription"
                  placeholder="Activity Description"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const title = (
                      document.getElementById("extraTitle") as HTMLInputElement
                    ).value.trim();
                    const desc = (
                      document.getElementById(
                        "extraDescription"
                      ) as HTMLTextAreaElement
                    ).value.trim();
                    if (title && desc) {
                      addItem("extra_curriculars", title, desc);
                      (
                        document.getElementById(
                          "extraTitle"
                        ) as HTMLInputElement
                      ).value = "";
                      (
                        document.getElementById(
                          "extraDescription"
                        ) as HTMLTextAreaElement
                      ).value = "";
                    }
                  }}
                >
                  Add Activity
                </Button>
              </div>

              <ul className="space-y-3">
                {parsedExtraCurriculars.map((activity, index) => (
                  <li
                    key={index}
                    className="flex items-start justify-between p-3 border rounded"
                  >
                    <div>
                      <h4 className="font-semibold">{activity.title}</h4>
                      <p className="text-sm text-gray-600">
                        {activity.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem("extra_curriculars", index)}
                      className="text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              {/* Personal Projects */}
              <h3 className="font-semibold text-lg mb-2">Personal Projects</h3>
              <div className="space-y-2 mb-4">
                <Input id="projectTitle" placeholder="Project Title" />
                <Textarea
                  id="projectDescription"
                  placeholder="Project Description"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const title = (
                      document.getElementById(
                        "projectTitle"
                      ) as HTMLInputElement
                    ).value.trim();
                    const desc = (
                      document.getElementById(
                        "projectDescription"
                      ) as HTMLTextAreaElement
                    ).value.trim();
                    if (title && desc) {
                      addItem("personal_projects", title, desc);
                      (
                        document.getElementById(
                          "projectTitle"
                        ) as HTMLInputElement
                      ).value = "";
                      (
                        document.getElementById(
                          "projectDescription"
                        ) as HTMLTextAreaElement
                      ).value = "";
                    }
                  }}
                >
                  Add Project
                </Button>
              </div>

              <ul className="space-y-3">
                {parsedPersonalProjects.map((proj, index) => (
                  <li
                    key={index}
                    className="flex items-start justify-between p-3 border rounded"
                  >
                    <div>
                      <h4 className="font-semibold">{proj.title}</h4>
                      <p className="text-sm text-gray-600">
                        {proj.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem("personal_projects", index)}
                      className="text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              {isDirtyMeta && (
                <Button
                  onClick={saveMetaInfo}
                  disabled={
                    loadingMeta ||
                    Object.values(metaErrors).some((err) => err !== "")
                  }
                  className="bg-green-500 hover:bg-green-600 text-white self-start"
                >
                  {loadingMeta ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
