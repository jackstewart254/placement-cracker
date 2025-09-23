"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Updated type to match the `individual_information` table
interface IndividualInformation {
  user_id: string;
  full_name: string;
  university: string;
  year_of_study: string; // keep as string for form input, convert to number before saving
  degree: string;
}

const PersonalInformation = () => {
  const supabase = createClient();

  const [userInfo, setUserInfo] = useState<IndividualInformation>({
    user_id: "",
    full_name: "",
    university: "",
    year_of_study: "",
    degree: "",
  });

  const [originalUserInfo, setOriginalUserInfo] =
    useState<IndividualInformation | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [errors, setErrors] = useState({
    full_name: "",
    university: "",
    year_of_study: "",
    degree: "",
  });

  // Validation regex
  const nameRegex = /^[A-Za-z]{2,}\s[A-Za-z]{2,}$/; // first and last name with at least 2 letters
  const yearRegex = /^[1-9]\d*$/; // positive number greater than 0
  const degreeRegex = /^(BSc|BA|MSc|MA|PhD|MBA)\b/i; // must start with these degree types

  // Fetch the user's information when the component mounts
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
        .from("individual_information")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching user info:", error.message);
      }

      if (data) {
        setUserInfo(data);
        setOriginalUserInfo(data);
        setHasExistingRecord(true);
      } else {
        const initialData = { ...userInfo, user_id: user.id };
        setUserInfo(initialData);
        setOriginalUserInfo(initialData);
        setHasExistingRecord(false);
      }

      setLoading(false);
    };

    fetchUserInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Handle changes to fields and mark form as dirty
  const handleChange = (field: keyof IndividualInformation, value: string) => {
    const updatedUserInfo = { ...userInfo, [field]: value };
    setUserInfo(updatedUserInfo);

    // Check if data has changed compared to the original
    setIsDirty(
      JSON.stringify(updatedUserInfo) !== JSON.stringify(originalUserInfo)
    );

    // Validate the specific field
    validateField(field, value);
  };

  // Validate individual fields
  const validateField = (field: keyof IndividualInformation, value: string) => {
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

    setErrors((prev) => ({ ...prev, [field]: errorMessage }));
  };

  // Save or update the user's information
  const handleSave = async () => {
    setLoading(true);

    if (!userInfo.user_id) {
      console.error("Cannot save without a valid user_id");
      setLoading(false);
      return;
    }

    try {
      const savePayload = {
        user_id: userInfo.user_id,
        full_name: userInfo.full_name,
        university: userInfo.university,
        year_of_study: Number(userInfo.year_of_study),
        degree: userInfo.degree,
      };

      const { error } = await supabase
        .from("individual_information")
        .upsert([savePayload]); // upsert will insert or update automatically

      if (error) throw error;

      setOriginalUserInfo(userInfo);
      setIsDirty(false);
      alert(
        hasExistingRecord
          ? "Information updated successfully!"
          : "Information saved successfully!"
      );

      setHasExistingRecord(true);
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
    <div className="flex flex-col gap-4 w-full">
      {/* Full Name */}
      <div>
        <input
          type="text"
          placeholder="Full Name"
          value={userInfo.full_name}
          onChange={(e) => handleChange("full_name", e.target.value)}
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full ${
            errors.full_name ? "border border-red-500" : ""
          }`}
        />
        {errors.full_name && (
          <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>
        )}
      </div>

      {/* University */}
      <input
        type="text"
        placeholder="University"
        value={userInfo.university}
        onChange={(e) => handleChange("university", e.target.value)}
        className="bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full"
      />

      {/* Year of Study */}
      <div>
        <input
          type="number"
          placeholder="Year of Study"
          value={userInfo.year_of_study}
          onChange={(e) => handleChange("year_of_study", e.target.value)}
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full ${
            errors.year_of_study ? "border border-red-500" : ""
          }`}
        />
        {errors.year_of_study && (
          <p className="text-red-500 text-xs mt-1">{errors.year_of_study}</p>
        )}
      </div>

      {/* Degree */}
      <div>
        <input
          type="text"
          placeholder="Degree e.g. BSc Computer Science Hons"
          value={userInfo.degree}
          onChange={(e) => handleChange("degree", e.target.value)}
          className={`bg-accent text-sm p-3 px-5 rounded-md text-foreground w-full ${
            errors.degree ? "border border-red-500" : ""
          }`}
        />
        {errors.degree && (
          <p className="text-red-500 text-xs mt-1">{errors.degree}</p>
        )}
      </div>

      {/* Save Button */}
      {isDirty && (
        <Button
          variant="default"
          onClick={handleSave}
          disabled={loading || Object.values(errors).some((err) => err !== "")}
          className="px-4 py-2 w-auto"
        >
          {loading ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
};

export default PersonalInformation;
