"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserInformation } from "@/types/userInformation";

export default function MetaInformation() {
  const supabase = createClient();

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

  // Regex validation rules
  const regexRules = {
    technical_skills: /^([A-Za-z0-9\s.+/()\-]+)(,\s*[A-Za-z0-9\s.+/()\-]+)*$/,
    soft_skills: /^([A-Za-z\s]+)(,\s*[A-Za-z\s]+)*$/, // Comma-separated soft skills
    extra_curriculars: /^.{10,}$/, // Minimum 10 characters
    personal_projects: /^([^\n]{5,})(\r?\n[^\n]{5,})*$/,
  };

const validateField = (field: keyof UserInformation, value: string) => {
  let errorMessage = "";

  // Only validate if the field has a regex rule
  if (!regexRules[field]) {
    return true; // Skip validation for unknown fields
  }

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
        errorMessage = "Extra Curriculars must be at least 10 characters long.";
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


  // Fetch user's information
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

      // Fetch user info from the table
      const { data, error } = await supabase
        .from("user_information")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching user info:", error.message);
      }

      if (data) {
        setUserInfo(data);
        setOriginalUserInfo(data);
      } else {
        const initialData = { ...userInfo, user_id: user.id };
        setUserInfo(initialData);
        setOriginalUserInfo(initialData);
      }

      setLoading(false);
    };

    fetchUserInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Handle changes to fields and track dirty state
  const handleChange = (field: keyof UserInformation, value: string) => {
    const updatedUserInfo = { ...userInfo, [field]: value };
    setUserInfo(updatedUserInfo);

    // Check if data has changed compared to the original
    setIsDirty(
      JSON.stringify(updatedUserInfo) !== JSON.stringify(originalUserInfo)
    );

    // Validate the specific field
    validateField(field, value);
  };

  // Save or update user information
  const handleSave = async () => {
    setLoading(true);

    if (!userInfo.user_id) {
      console.error("Cannot save without a valid user_id");
      setLoading(false);
      return;
    }

    // Validate all fields before saving
    const isValid = (Object.keys(userInfo) as (keyof UserInformation)[]).every(
      (field) => validateField(field, userInfo[field])
    );

    if (!isValid) {
      alert("Please fix the validation errors before saving.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("user_information")
        .upsert([userInfo]);

      if (error) throw error;

      setOriginalUserInfo(userInfo);
      setIsDirty(false);
      alert("Information saved successfully!");
    } catch (err: any) {
      console.error("Error saving information:", err.message);
      alert("There was an error saving your information. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Technical Skills */}
      <div>
        <textarea
          placeholder="Technical Skills (comma-separated)"
          value={userInfo.technical_skills}
          onChange={(e) => handleChange("technical_skills", e.target.value)}
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full ${
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
          placeholder="Soft Skills (comma-separated)"
          value={userInfo.soft_skills}
          onChange={(e) => handleChange("soft_skills", e.target.value)}
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full ${
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
          placeholder="Extra Curriculars (minimum 10 characters)"
          value={userInfo.extra_curriculars}
          onChange={(e) => handleChange("extra_curriculars", e.target.value)}
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full ${
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
          placeholder="Personal Projects (each on a new line, minimum 5 characters)"
          value={userInfo.personal_projects}
          onChange={(e) => handleChange("personal_projects", e.target.value)}
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full ${
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
