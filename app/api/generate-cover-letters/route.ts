import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import OpenAI from "openai";
import { encode } from "gpt-tokenizer"; // ✅ Import tokenizer

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1. Verify user session
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user_id = authData.user.id;

  // 2. Parse request body
  const { jobs } = await req.json();
  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ error: "No jobs provided" }, { status: 400 });
  }

  // 3. Check credits
  const { data: credits, error: creditsError } = await supabase
    .from("user_credits")
    .select("cover_letter_credits")
    .eq("user_id", user_id)
    .single();

  if (creditsError || !credits) {
    return NextResponse.json(
      { error: "Could not fetch your credits. Please try again later." },
      { status: 500 }
    );
  }

  if (credits.cover_letter_credits <= 0) {
    return NextResponse.json(
      {
        error:
          "Sorry, you are out of credits. Share your referral code and get friends to sign up for more cover letter generations!",
      },
      { status: 403 }
    );
  }

  // 4. Decrement credits immediately
  const { error: updateCreditsError } = await supabase
    .from("user_credits")
    .update({ cover_letter_credits: credits.cover_letter_credits - 1 })
    .eq("user_id", user_id);

  if (updateCreditsError) {
    console.error("Error updating credits:", updateCreditsError.message);
    return NextResponse.json(
      { error: "Unable to update your credits. Please try again later." },
      { status: 500 }
    );
  }

  // 5. Individual info
  const { data: individualInfo, error: individualError } = await supabase
    .from("individual_information")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (individualError || !individualInfo) {
    return NextResponse.json(
      { error: "Individual information not found for this user." },
      { status: 404 }
    );
  }

  // 6. Extended user info
  const { data: userInfo, error: userInfoError } = await supabase
    .from("user_information")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (userInfoError || !userInfo) {
    return NextResponse.json(
      { error: "User technical information not found." },
      { status: 404 }
    );
  }

  // ✅ Format JSON fields
  const formatExtraCurriculars = (raw: string) => {
    try {
      const data = JSON.parse(raw || "[]");
      if (!Array.isArray(data) || data.length === 0) return "None provided";
      return data
        .map(
          (item: { title: string; description: string }) =>
            `• ${item.title} - ${item.description}`
        )
        .join("\n");
    } catch {
      return "None provided";
    }
  };

  const formatPersonalProjects = (raw: string) => {
    try {
      const data = JSON.parse(raw || "[]");
      if (!Array.isArray(data) || data.length === 0) return "None provided";
      return data
        .map(
          (item: { title: string; description: string }) =>
            `• ${item.title} - ${item.description}`
        )
        .join("\n");
    } catch {
      return "None provided";
    }
  };

  const formattedExtraCurriculars = formatExtraCurriculars(
    userInfo.extra_curriculars
  );
  const formattedPersonalProjects = formatPersonalProjects(
    userInfo.personal_projects
  );

  // 7. Init OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results = [];

  // 8. Process jobs
  for (const job of jobs) {
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job.id)
      .single();

    if (jobError || !jobData) {
      console.error("Error fetching job:", jobError);
      continue;
    }

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", jobData.company_id)
      .single();

    if (companyError || !companyData) {
      console.error("Error fetching company:", companyError);
      continue;
    }

    // 9. Build AI prompt
    const aiPrompt = `
You are an expert career assistant. Write a personalized, professional cover letter using the provided information.

---
**Individual Information:**
- Full Name: ${individualInfo.full_name}
- University: ${individualInfo.university}
- Year of Study: ${individualInfo.year_of_study}
- Degree: ${individualInfo.degree}

**User Technical Information:**
- Technical Skills: ${userInfo.technical_skills || "None provided"}
- Soft Skills: ${userInfo.soft_skills || "None provided"}

**Extra Curricular Activities:**
${formattedExtraCurriculars}

**Personal Projects:**
${formattedPersonalProjects}

**Job Information:**
- Job Title: ${jobData.job_title}
- Description: ${jobData.description}

**Company Information:**
- Company Name: ${companyData.name}

---
**Instructions for AI:**
Create a structured cover letter with **four paragraphs**, following this exact format:

1. **Introduction:**  
   - Clearly state the position you are applying for and mention that you discovered the opportunity on Prosple.  
   - Briefly explain why you are excited about this role and the company.

2. **Body Paragraph:**  
   - Highlight your most relevant technical skills, experiences, and achievements that directly match the job description.  
   - Use specific examples to demonstrate how your background aligns with the requirements of the role.

3. **Cultural, Team and Company Fit Paragraph:**  
   - Explain why you believe you are a great fit for the company's team, culture, and working environment.  
   - Show that you understand the company's values and how your personality, soft skills, and approach to work will help you thrive there.

4. **Polite Closing Paragraph:**  
   - End with a short, polite sentence expressing your enthusiasm and that you are looking forward to hearing back from them soon.

**Additional Guidelines:**
- Keep the tone professional yet warm and approachable.
- Be concise and avoid overly generic language or clichés.
- Ensure each paragraph flows naturally into the next.
- Return only the final cover letter text — no extra commentary, notes, or explanations.
- Word count must be between 335 and 380
`;

    // ✅ Accurate token count for input
    const tokenInput = encode(aiPrompt).length;

    // 10. Start timing
    const startTime = Date.now();

    // 11. Send prompt
    const response = await openai.responses.create({
      model: "gpt-5",
      input: aiPrompt,
    });

    // 12. End timing
    const endTime = Date.now();
    const generationTimeSeconds = Math.round((endTime - startTime) / 1000);

    const generatedLetter = response.output_text;

    // ✅ Accurate token count for output
    const tokenOutput = encode(generatedLetter).length;

    // 13. Insert into requests (for analytics/logging)
    const { error: requestInsertError } = await supabase
      .from("requests")
      .insert([
        {
          user_id,
          job_id: job.id,
          input: aiPrompt,
          token_input: tokenInput,
          token_output: tokenOutput,
          "time (s)": generationTimeSeconds,
        },
      ]);

    if (requestInsertError) {
      console.error(
        "Error inserting into requests:",
        requestInsertError.message
      );
      continue;
    }

    // 14. Save cover letter
    const { data: insertedCoverLetter, error: insertError } = await supabase
      .from("cover_letters")
      .insert([
        {
          user_id,
          job_id: job.id,
          cover_letter: generatedLetter,
        },
      ])
      .select()
      .single();

    if (insertError || !insertedCoverLetter) {
      console.error("Error inserting cover letter:", insertError?.message);
      continue;
    }

    // 15. Upsert into tracking
    const { error: trackingError } = await supabase
      .from("tracking")
      .upsert(
        {
          user_id,
          job_id: job.id,
          status: "Not Applied",
          auto_favourite: true,
          cover_letter_id: insertedCoverLetter.id,
        },
        {
          onConflict: "user_id,job_id",
        }
      );

    if (trackingError) {
      console.error("Error inserting into tracking:", trackingError.message);
    }

    results.push(insertedCoverLetter);
  }

  return NextResponse.json({ success: true, data: results });
}
