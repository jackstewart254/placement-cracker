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
        set: () => {},    // no-op
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
      {
        error: "Rate limit reached, wait until midnight to start again.",
      },
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
You are an expert career assistant. Write a personalized and professional cover letter using the provided information.

---
**Individual Information:**
- Full Name: ${individualInfo.full_name}
- University: ${individualInfo.university}
- Year of Study: ${individualInfo.year_of_study}
- Degree: ${individualInfo.degree}

**User Technical Information:**
- Technical Skills: ${userInfo.technical_skills}
- Soft Skills: ${userInfo.soft_skills}
- Extra Curriculars: ${userInfo.extra_curriculars}
- Personal Projects: ${userInfo.personal_projects}

**Job Information:**
- Job Title: ${jobData.job_title}
- Category: ${jobData.category}
- Description: ${jobData.description}

**Company Information:**
- Company Name: ${companyData.name}

---
**Instructions for AI:**
- Analyze the job description and match it with the candidate's background.
- Highlight the most relevant technical skills, soft skills, and projects.
- Structure the cover letter in 3 sections:
  1. Introduction: Why the candidate is excited about the role and company.
  2. Main Body: Candidate's key qualifications and experiences that fit the job.
  3. Conclusion: Closing remarks and call to action.
- Keep the tone professional but engaging.
- Return only the cover letter text with no extra commentary.
`;

    // 9. Calculate token cost for input
    const inputWordCount = aiPrompt.trim().split(/\s+/).length;
    const tokenInput = Math.ceil(inputWordCount * 1.33); // Estimate tokens for input

    // 10. Send prompt to OpenAI
    const response = await openai.responses.create({
      model: "gpt-5",
      input: aiPrompt,
    });

    const generatedLetter = response.output_text;

    // 11. Calculate token cost for output
    const outputWordCount = generatedLetter.trim().split(/\s+/).length;
    const tokenOutput = Math.ceil(outputWordCount * 1.33); // Estimate tokens for output

    // 12. Insert request log into "requests" table
    const { error: requestInsertError } = await supabase
      .from("requests")
      .insert([
        {
          user_id,
          job_id: job.id,
          input: aiPrompt,
          token_input: tokenInput,
          token_output: tokenOutput,
        },
      ]);

    if (requestInsertError) {
      console.error("Error inserting into requests:", requestInsertError.message);
      continue;
    }

    // 13. Insert generated cover letter into "cover_letters" table
    const { data: inserted, error: insertError } = await supabase
      .from("cover_letters")
      .insert([
        {
          user_id,
          job_id: job.id,
          cover_letter: generatedLetter,
        },
      ])
      .select();

    if (insertError) {
      console.error("Error inserting cover letter:", insertError.message);
      continue;
    }

    results.push(inserted[0]);
  }

  return NextResponse.json({ success: true, data: results });
}
