"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserInformation } from "@/types/userInformation";

export default function MetaInformation() {
  const supabase = createClient();

  // ✅ No user_id here anymore
  const [userInfo, setUserInfo] = useState<UserInformation>({
    technical_skills: "",
    soft_skills: "",
    extra_curriculars: "",
    personal_projects: "",
  });

  const [originalUserInfo, setOriginalUserInfo] =
    useState<UserInformation | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [errors, setErrors] = useState({
    technical_skills: "",
    soft_skills: "",
    extra_curriculars: "",
    personal_projects: "",
  });

  // Refs for auto-resizing textareas
  const technicalSkillsRef = useRef<HTMLTextAreaElement | null>(null);
  const softSkillsRef = useRef<HTMLTextAreaElement | null>(null);
  const extraCurricularsRef = useRef<HTMLTextAreaElement | null>(null);
  const personalProjectsRef = useRef<HTMLTextAreaElement | null>(null);

  // Helper to auto-resize textarea
  const autoResize = (element: HTMLTextAreaElement) => {
    if (!element) return;
    element.style.height = "auto"; // Reset
    element.style.height = `${element.scrollHeight}px`; // Fit content
  };

  // Regex validation rules
  const regexRules = {
    technical_skills: /^([A-Za-z0-9\s.+/()\-]+)(,\s*[A-Za-z0-9\s.+/()\-]+)*$/,
    soft_skills: /^([A-Za-z\s\-.]+)(,\s*[A-Za-z\s\-.]+)*$/,
    extra_curriculars: /^.{10,}$/, // Minimum 10 characters
    personal_projects: /^([^\n]{5,})(\r?\n[^\n]{5,})*$/,
  };

  const validateField = (field: keyof UserInformation, value: string) => {
    let errorMessage = "";

    if (!regexRules[field]) return true;

    if (!regexRules[field].test(value)) {
      switch (field) {
        case "technical_skills":
          errorMessage =
            "Technical skills must be comma-separated (e.g., JavaScript, CSS, HTML).";
          break;
        case "soft_skills":
          errorMessage =
            "Soft skills must be comma-separated (e.g., Communication, Teamwork).";
          break;
        case "extra_curriculars":
          errorMessage =
            "Extra Curriculars must be at least 10 characters long.";
          break;
        case "personal_projects":
          errorMessage =
            "Each project must be on a new line and at least 5 characters long.";
          break;
      }
    }

    setErrors((prev) => ({ ...prev, [field]: errorMessage }));
    return errorMessage === "";
  };

  // Fetch user data
  useEffect(() => {
    const fetchUserInfo = async () => {
      setLoading(true);

      // Get current authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "Error fetching user:",
          userError?.message || "No user found"
        );
        setLoading(false);
        return;
      }

      // Fetch the user's information
      const { data, error } = await supabase
        .from("user_information")
        .select("*")
        .eq("user_id", user.id) // still filter by user_id in the query
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching user info:", error.message);
      }

      // Load data or empty defaults
      const loadedData = data || {
        technical_skills: "",
        soft_skills: "",
        extra_curriculars: "",
        personal_projects: "",
      };

      setUserInfo(loadedData);
      setOriginalUserInfo(loadedData);

      setLoading(false);
    };

    fetchUserInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run autoResize AFTER userInfo loads
  useEffect(() => {
    if (technicalSkillsRef.current) autoResize(technicalSkillsRef.current);
    if (softSkillsRef.current) autoResize(softSkillsRef.current);
    if (extraCurricularsRef.current) autoResize(extraCurricularsRef.current);
    if (personalProjectsRef.current) autoResize(personalProjectsRef.current);
  }, [userInfo]);

  // Handle changes to fields
  const handleChange = (
    field: keyof UserInformation,
    value: string,
    element?: HTMLTextAreaElement
  ) => {
    const updatedUserInfo = { ...userInfo, [field]: value };
    setUserInfo(updatedUserInfo);

    if (element) autoResize(element);

    setIsDirty(
      JSON.stringify(updatedUserInfo) !== JSON.stringify(originalUserInfo)
    );
    validateField(field, value);
  };

  // Save or update user information
  const handleSave = async () => {
    setLoading(true);

    // Get current authenticated user here for saving
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error fetching user for save:", userError?.message);
      setLoading(false);
      return;
    }

    const isValid = (Object.keys(userInfo) as (keyof UserInformation)[]).every(
      (field) => validateField(field, userInfo[field])
    );

    if (!isValid) {
      alert("Please fix the validation errors before saving.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from("user_information").upsert([
        {
          ...userInfo,
          user_id: user.id, // Only pass here when saving, not stored in state
        },
      ]);

      if (error) throw error;

      setOriginalUserInfo(userInfo);
      setIsDirty(false);
      alert("Information saved successfully!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error saving information:", err.message);
        alert("There was an error saving your information. Please try again.");
      } else {
        console.error("Unexpected error saving information:", err);
        alert("An unexpected error occurred. Please try again.");
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Technical Skills */}
      <div>
        <textarea
          ref={technicalSkillsRef}
          placeholder="Technical Skills (comma-separated)"
          value={userInfo.technical_skills}
          onInput={(e) =>
            handleChange(
              "technical_skills",
              e.currentTarget.value,
              e.currentTarget
            )
          }
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full resize-none overflow-hidden ${
            errors.technical_skills ? "border border-red-500" : ""
          }`}
        />
        {errors.technical_skills && (
          <p className="text-red-500 text-xs mt-1">{errors.technical_skills}</p>
        )}
      </div>

      {/* Soft Skills */}
      <div>
        <textarea
          ref={softSkillsRef}
          placeholder="Soft Skills (comma-separated)"
          value={userInfo.soft_skills}
          onInput={(e) =>
            handleChange("soft_skills", e.currentTarget.value, e.currentTarget)
          }
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full resize-none overflow-hidden ${
            errors.soft_skills ? "border border-red-500" : ""
          }`}
        />
        {errors.soft_skills && (
          <p className="text-red-500 text-xs mt-1">{errors.soft_skills}</p>
        )}
      </div>

      {/* Extra Curriculars */}
      <div>
        <textarea
          ref={extraCurricularsRef}
          placeholder="Extra Curriculars (minimum 10 characters)"
          value={userInfo.extra_curriculars}
          onInput={(e) =>
            handleChange(
              "extra_curriculars",
              e.currentTarget.value,
              e.currentTarget
            )
          }
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full resize-none overflow-hidden ${
            errors.extra_curriculars ? "border border-red-500" : ""
          }`}
        />
        {errors.extra_curriculars && (
          <p className="text-red-500 text-xs mt-1">
            {errors.extra_curriculars}
          </p>
        )}
      </div>

      {/* Personal Projects */}
      <div>
        <textarea
          ref={personalProjectsRef}
          placeholder="Personal Projects (each on a new line, minimum 5 characters)"
          value={userInfo.personal_projects}
          onInput={(e) =>
            handleChange(
              "personal_projects",
              e.currentTarget.value,
              e.currentTarget
            )
          }
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full resize-none overflow-hidden ${
            errors.personal_projects ? "border border-red-500" : ""
          }`}
        />
        {errors.personal_projects && (
          <p className="text-red-500 text-xs mt-1">
            {errors.personal_projects}
          </p>
        )}
      </div>

      {/* Save Button */}
      {isDirty && (
        <button
          onClick={handleSave}
          disabled={loading || Object.values(errors).some((err) => err !== "")}
          className="w-auto bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm mt-4 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      )}
    </div>
  );
}
