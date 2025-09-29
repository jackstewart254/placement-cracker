import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

/* ------------------------------
   OpenAI Setup
------------------------------ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* ------------------------------
   POST Handler
------------------------------ */
export async function POST(req: Request) {
  try {
    /* ------------------------------
       1. Create Supabase Client
    ------------------------------ */
    const supabase = await createClient();

    /* ------------------------------
       2. Validate User Session
    ------------------------------ */
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ------------------------------
       3. Parse Request Body
    ------------------------------ */
    const body = await req.json();
    const { session_id, question, comment, word_limit } = body;

    if (!session_id || !question) {
      return NextResponse.json(
        { error: "session_id and question are required" },
        { status: 400 }
      );
    }

    /* ------------------------------
       4. Fetch Job & Company Data
    ------------------------------ */
    const { data: jobData, error: jobError } = await supabase
      .from("chat_sessions")
      .select(
        `
        jobs(
          job_title,
          description,
          companies(name)
        )
      `
      )
      .eq("id", session_id)
      .single();

    if (jobError || !jobData) {
      console.error("Error fetching job data:", jobError);
      return NextResponse.json(
        { error: "Failed to fetch job and company data" },
        { status: 500 }
      );
    }

    const companyName = jobData.jobs.companies.name;
    const jobTitle = jobData.jobs.job_title;
    const jobDescription = jobData.jobs.description;

    /* ------------------------------
       5. Fetch User Information
    ------------------------------ */
    const { data: userInfo, error: userInfoError } = await supabase
      .from("user_information")
      .select(
        "technical_skills, soft_skills, extra_curriculars, personal_projects"
      )
      .eq("user_id", user.id)
      .single();

    if (userInfoError || !userInfo) {
      console.error("Error fetching user information:", userInfoError);
      return NextResponse.json(
        { error: "Failed to fetch user information" },
        { status: 500 }
      );
    }

    /* ------------------------------
       6. Build AI Prompt
    ------------------------------ */
    const prompt = `
You are helping a student answer a placement application question.
Your goal is to create a response that perfectly aligns with:
1. The company and its culture.
2. The job role and description.
3. The student's personal background, skills, and experiences.

Company: ${companyName}
Job Title: ${jobTitle}
Job Description: ${jobDescription}

Student's Profile:
- Technical Skills: ${userInfo.technical_skills}
- Soft Skills: ${userInfo.soft_skills}
- Extra Curriculars: ${userInfo.extra_curriculars}
- Personal Projects: ${userInfo.personal_projects}

Application Question:
"${question}"

${comment ? `User has requested this adjustment: ${comment}` : ""}

${word_limit ? `Please keep the answer under ${word_limit} words.` : ""}

Your response should:
- Be highly relevant to the role and company.
- Demonstrate the student's unique fit using their skills and experience.
- Be structured clearly and professionally, with a natural and authentic tone.
    `;

    /* ------------------------------
       6.5 Prepare Input Metadata (full prompt)
    ------------------------------ */
    const inputSize = prompt.length;
    const tokenSize = Math.ceil(inputSize / 4); // rough token estimate

    /* ------------------------------
       6.6 Check Daily Limit in JS
       - Get all chat_sessions for this user
       - Then fetch chat_inputs tied to those sessions
       - Count how many are from today
    ------------------------------ */
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", user.id);

    if (sessionsError || !sessionsData) {
      console.error("Error fetching chat sessions:", sessionsError);
      return NextResponse.json(
        { error: "Could not verify daily usage limit (sessions)." },
        { status: 500 }
      );
    }

    const sessionIds = sessionsData.map((s) => s.id);

    if (sessionIds.length === 0) {
      // User has no sessions yet, so 0 generations
      console.log("No previous sessions found, skipping daily limit check.");
    } else {
      const { data: inputsData, error: inputsError } = await supabase
        .from("chat_inputs")
        .select("id, created_at, session_id")
        .in("session_id", sessionIds);

      if (inputsError || !inputsData) {
        console.error("Error fetching chat inputs:", inputsError);
        return NextResponse.json(
          { error: "Could not verify daily usage limit (inputs)." },
          { status: 500 }
        );
      }

      // Filter in JS by today's UTC date
      const now = new Date();
      const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const endOfDayUtc = new Date(startOfDayUtc);
      endOfDayUtc.setUTCDate(endOfDayUtc.getUTCDate() + 1);

      const todaysInputs = inputsData.filter((input) => {
        const createdAt = new Date(input.created_at);
        return createdAt >= startOfDayUtc && createdAt < endOfDayUtc;
      });

      if (todaysInputs.length >= 20) {
        return NextResponse.json(
          { error: "Daily generation limit reached. Please try again tomorrow." },
          { status: 403 }
        );
      }
    }

    /* ------------------------------
       7. Insert into chat_inputs
    ------------------------------ */
    const { data: inputRecord, error: inputError } = await supabase
      .from("chat_inputs")
      .insert([
        {
          session_id,
          question,
          comment: comment || null,
          input_size: inputSize,
          token_size: tokenSize,
          word_limit: word_limit || null,
        },
      ])
      .select()
      .single();

    if (inputError || !inputRecord) {
      console.error("Error inserting chat_input:", inputError);
      return NextResponse.json(
        { error: "Failed to store chat input" },
        { status: 500 }
      );
    }

    /* ------------------------------
       8. Generate Answer using OpenAI
    ------------------------------ */
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates compelling, professional, and tailored answers for placement applications.",
        },
        { role: "user", content: prompt },
      ],
    });

    const answer =
      aiResponse.choices[0]?.message?.content?.trim() ||
      "No answer generated.";

    const outputTokens = aiResponse.usage?.completion_tokens || null;

    /* ------------------------------
       9. Insert into chat_outputs
    ------------------------------ */
    const { error: outputError } = await supabase.from("chat_outputs").insert([
      {
        id: inputRecord.id, // FK to chat_inputs.id
        answer,
        output_tokens: outputTokens,
      },
    ]);

    if (outputError) {
      console.error("Error inserting chat_output:", outputError);
      return NextResponse.json(
        { error: "Failed to store chat output" },
        { status: 500 }
      );
    }

    /* ------------------------------
       10. Return Generated Answer
    ------------------------------ */
    return NextResponse.json({
      success: true,
      answer,
      input_id: inputRecord.id,
      session_id,
    });
  } catch (err) {
    console.error("Error generating answer:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
