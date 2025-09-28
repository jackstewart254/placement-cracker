"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserInformation } from "@/types/userInformation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

export default function MetaInformation() {
  const supabase = createClient();

  /* ---------- STATE ---------- */
  const [userInfo, setUserInfo] = useState<UserInformation>({
    technical_skills: "",
    soft_skills: "",
    extra_curriculars: "[]", // JSON string
    personal_projects: "[]", // JSON string
  });

  const [originalUserInfo, setOriginalUserInfo] =
    useState<UserInformation | null>(null);

  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [errors, setErrors] = useState({
    technical_skills: "",
    soft_skills: "",
  });

  /* ---------- REFS ---------- */
  const technicalSkillsRef = useRef<HTMLTextAreaElement | null>(null);
  const softSkillsRef = useRef<HTMLTextAreaElement | null>(null);

  /* ---------- AUTO-RESIZE ---------- */
  const autoResize = (element: HTMLTextAreaElement) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  /* ---------- VALIDATION ---------- */
  const regexRules = {
    technical_skills: /^([A-Za-z0-9\s.+/()\-]+)(,\s*[A-Za-z0-9\s.+/()\-]+)*$/,
    soft_skills: /^([A-Za-z\s\-.]+)(,\s*[A-Za-z\s\-.]+)*$/,
  };

  const validateField = (field: keyof UserInformation, value: string) => {
    let errorMessage = "";

    if (regexRules[field] && !regexRules[field].test(value)) {
      switch (field) {
        case "technical_skills":
          errorMessage =
            "Technical skills must be comma-separated (e.g., JavaScript, CSS, HTML).";
          break;
        case "soft_skills":
          errorMessage =
            "Soft skills must be comma-separated (e.g., Communication, Teamwork).";
          break;
      }
    }

    setErrors((prev) => ({ ...prev, [field]: errorMessage }));
    return errorMessage === "";
  };

  /* ---------- FETCH USER DATA ---------- */
  useEffect(() => {
    const fetchUserInfo = async () => {
      setLoading(true);

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

      const { data, error } = await supabase
        .from("user_information")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching user info:", error.message);
      }

      const loadedData = data || {
        technical_skills: "",
        soft_skills: "",
        extra_curriculars: "[]",
        personal_projects: "[]",
      };

      setUserInfo(loadedData);
      setOriginalUserInfo(loadedData);
      setLoading(false);
    };

    fetchUserInfo();
  }, [supabase]);

  /* ---------- AUTO-RESIZE WHEN DATA LOADS ---------- */
  useEffect(() => {
    if (technicalSkillsRef.current) autoResize(technicalSkillsRef.current);
    if (softSkillsRef.current) autoResize(softSkillsRef.current);
  }, [userInfo]);

  /* ---------- FIELD HANDLERS ---------- */
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

    if (field === "technical_skills" || field === "soft_skills") {
      validateField(field, value);
    }
  };

  /* ---------- SAVE TO SUPABASE ---------- */
  const handleSave = async () => {
    setLoading(true);

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
      (field) =>
        field === "extra_curriculars" || field === "personal_projects"
          ? true
          : validateField(field, userInfo[field])
    );

    if (!isValid) {
      alert("Please fix validation errors before saving.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from("user_information").upsert([
        {
          ...userInfo,
          user_id: user.id,
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

  /* ---------- PARSE JSON FIELDS ---------- */
  const parsedExtraCurriculars = JSON.parse(
    userInfo.extra_curriculars || "[]"
  ) as { title: string; description: string }[];

  const parsedPersonalProjects = JSON.parse(
    userInfo.personal_projects || "[]"
  ) as { title: string; description: string }[];

  /* ---------- EXTRA CURRICULARS ---------- */
  const addExtraCurricular = (title: string, description: string) => {
    const updated = [...parsedExtraCurriculars, { title, description }];
    handleChange("extra_curriculars", JSON.stringify(updated));
  };

  const removeExtraCurricular = (index: number) => {
    const updated = parsedExtraCurriculars.filter((_, i) => i !== index);
    handleChange("extra_curriculars", JSON.stringify(updated));
  };

  /* ---------- PERSONAL PROJECTS ---------- */
  const addPersonalProject = (title: string, description: string) => {
    const updated = [...parsedPersonalProjects, { title, description }];
    handleChange("personal_projects", JSON.stringify(updated));
  };

  const removePersonalProject = (index: number) => {
    const updated = parsedPersonalProjects.filter((_, i) => i !== index);
    handleChange("personal_projects", JSON.stringify(updated));
  };

  /* ---------- UI ---------- */
  return (
    <div className="flex flex-col gap-6">
      {/* Technical Skills */}
      <Textarea
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
        className={errors.technical_skills ? "border-red-500" : ""}
      />
      {errors.technical_skills && (
        <p className="text-red-500 text-xs mt-1">{errors.technical_skills}</p>
      )}

      {/* Soft Skills */}
      <Textarea
        ref={softSkillsRef}
        placeholder="Soft Skills (comma-separated)"
        value={userInfo.soft_skills}
        onInput={(e) =>
          handleChange("soft_skills", e.currentTarget.value, e.currentTarget)
        }
        className={errors.soft_skills ? "border-red-500" : ""}
      />
      {errors.soft_skills && (
        <p className="text-red-500 text-xs mt-1">{errors.soft_skills}</p>
      )}

      <Separator />

      {/* Extra Curriculars */}
      <h3 className="font-semibold text-lg mb-2">
        Extra Curricular Activities
      </h3>
      <div className="space-y-2 mb-4">
        <Input id="extraTitle" placeholder="Activity Title" />
        <Textarea id="extraDescription" placeholder="Activity Description" />
        <Button
          type="button"
          onClick={() => {
            const titleInput = document.getElementById(
              "extraTitle"
            ) as HTMLInputElement;
            const descInput = document.getElementById(
              "extraDescription"
            ) as HTMLTextAreaElement;

            if (titleInput.value.trim() && descInput.value.trim()) {
              addExtraCurricular(
                titleInput.value.trim(),
                descInput.value.trim()
              );
              titleInput.value = "";
              descInput.value = "";
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
              <p className="text-sm text-gray-600">{activity.description}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeExtraCurricular(index)}
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
        <Textarea id="projectDescription" placeholder="Project Description" />
        <Button
          type="button"
          onClick={() => {
            const titleInput = document.getElementById(
              "projectTitle"
            ) as HTMLInputElement;
            const descInput = document.getElementById(
              "projectDescription"
            ) as HTMLTextAreaElement;

            if (titleInput.value.trim() && descInput.value.trim()) {
              addPersonalProject(
                titleInput.value.trim(),
                descInput.value.trim()
              );
              titleInput.value = "";
              descInput.value = "";
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
              <p className="text-sm text-gray-600">{proj.description}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removePersonalProject(index)}
              className="text-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </li>
        ))}
      </ul>

      {/* Save Button */}
      {isDirty && (
        <Button
          onClick={handleSave}
          disabled={loading || Object.values(errors).some((err) => err !== "")}
          className="self-start bg-green-500 hover:bg-green-600 text-white"
        >
          {loading ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
}
