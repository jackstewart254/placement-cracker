import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";

export async function POST(req: Request) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => (await cookieStore).get(name)?.value,
        set: () => {}, // no-op
        remove: () => {}, // no-op
      },
    }
  );

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

  // 3. Check rate limit (max 15 requests per day)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data: requestsToday, error: requestsError } = await supabase
    .from("requests")
    .select("id")
    .eq("user_id", user_id)
    .gte("created_at", startOfDay)
    .lt("created_at", endOfDay);

  if (requestsError) {
    console.error("Error fetching today's requests:", requestsError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (requestsToday && requestsToday.length >= 15) {
    return NextResponse.json(
      { error: "Rate limit reached, wait until midnight to start again." },
      { status: 429 }
    );
  }

  // 4. Fetch individual information
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

  // 5. Fetch extended user information
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

  // ✅ Parse and format JSON fields
  const formatExtraCurriculars = (raw: string) => {
    try {
      const data = JSON.parse(raw || "[]");
      if (!Array.isArray(data) || data.length === 0) return "None provided";
      return data
        .map((item: { title: string; description: string }) =>
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
        .map((item: { title: string; description: string }) =>
          `• ${item.title} - ${item.description}`
        )
        .join("\n");
    } catch {
      return "None provided";
    }
  };

  const formattedExtraCurriculars = formatExtraCurriculars(userInfo.extra_curriculars);
  const formattedPersonalProjects = formatPersonalProjects(userInfo.personal_projects);

  // 6. Initialize OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const results = [];

  // 7. Process each job
  for (const job of jobs) {
    // Fetch full job details
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job.id)
      .single();

    if (jobError || !jobData) {
      console.error("Error fetching job:", jobError);
      continue;
    }

    // Fetch company details
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", jobData.company_id)
      .single();

    if (companyError || !companyData) {
      console.error("Error fetching company:", companyError);
      continue;
    }

    // 8. Build AI prompt
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

3. **Cultural & Team Fit Paragraph:**  
   - Explain why you believe you are a great fit for the company's team, culture, and working environment.  
   - Show that you understand the company's values and how your personality, soft skills, and approach to work will help you thrive there.

4. **Polite Closing Paragraph:**  
   - End with a short, polite sentence expressing your enthusiasm and that you are looking forward to hearing back from them soon.

**Additional Guidelines:**
- Keep the tone professional yet warm and approachable.
- Be concise and avoid overly generic language or clichés.
- Ensure each paragraph flows naturally into the next.
- Return only the final cover letter text — no extra commentary, notes, or explanations.
`;

    // 9. Calculate token cost for input
    const inputWordCount = aiPrompt.trim().split(/\s+/).length;
    const tokenInput = Math.ceil(inputWordCount * 1.33); // Estimate tokens for input

    // 10. Start timing
    const startTime = Date.now();

    // 11. Send prompt to OpenAI
    const response = await openai.responses.create({
      model: "gpt-5",
      input: aiPrompt,
    });

    // 12. End timing
    const endTime = Date.now();
    const generationTimeSeconds = Math.round((endTime - startTime) / 1000); // convert ms → s

    const generatedLetter = response.output_text;

    // 13. Calculate token cost for output
    const outputWordCount = generatedLetter.trim().split(/\s+/).length;
    const tokenOutput = Math.ceil(outputWordCount * 1.33); // Estimate tokens for output

    // 14. Insert request log into "requests" table
    const { error: requestInsertError } = await supabase
      .from("requests")
      .insert([
        {
          user_id,
          job_id: job.id,
          input: aiPrompt,
          token_input: tokenInput,
          token_output: tokenOutput,
          "time (s)": generationTimeSeconds, // ✅ track generation time in seconds
        },
      ]);

    if (requestInsertError) {
      console.error("Error inserting into requests:", requestInsertError.message);
      continue;
    }

    // 15. Insert generated cover letter into "cover_letters" table
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

    // 16. Insert into tracking table — link to cover letter
    const { error: trackingError } = await supabase
      .from("tracking")
      .upsert(
        {
          user_id,
          job_id: job.id,
          status: "Not Applied",
          auto_favourite: true,
          cover_letter_id: insertedCoverLetter.id, // Link generated cover letter
        },
        {
          onConflict: "user_id,job_id", // Avoid duplicates by updating if record already exists
        }
      );

    if (trackingError) {
      console.error("Error inserting into tracking:", trackingError.message);
    }

    results.push(insertedCoverLetter);
  }

  return NextResponse.json({ success: true, data: results });
}
