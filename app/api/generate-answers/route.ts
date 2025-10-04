import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { encode } from "gpt-tokenizer"; // ✅ Import tokenizer

/* ------------------------------
   OpenAI Setup
------------------------------ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, question, comment, word_limit } = body;

    if (!session_id || !question) {
      return NextResponse.json(
        { error: "session_id and question are required" },
        { status: 400 }
      );
    }

    /* ------------------------------
       Credit Check
    ------------------------------ */
    const { data: credits, error: creditsError } = await supabase
      .from("user_credits")
      .select("resolve_ai_credits")
      .eq("user_id", user.id)
      .single();

    if (creditsError || !credits) {
      console.error("Error fetching credits:", creditsError);
      return NextResponse.json(
        { error: "Could not fetch your credits. Please try again later." },
        { status: 500 }
      );
    }

    if (credits.resolve_ai_credits <= 0) {
      return NextResponse.json(
        {
          error:
            "Sorry, you are out of credits. Share your referral code and get friends to sign up for more ResolveAI questions!",
        },
        { status: 403 }
      );
    }

    // ✅ Decrement one credit before generation
    const { error: updateCreditsError } = await supabase
      .from("user_credits")
      .update({
        resolve_ai_credits: credits.resolve_ai_credits - 1,
      })
      .eq("user_id", user.id);

    if (updateCreditsError) {
      console.error("Error updating credits:", updateCreditsError);
      return NextResponse.json(
        { error: "Unable to update your credits. Please try again later." },
        { status: 500 }
      );
    }

    /* ------------------------------
       Fetch Job & Company
    ------------------------------ */
    const { data: jobData, error: jobError } = await supabase
      .from("chat_sessions")
      .select(
        `jobs(
          job_title,
          description,
          companies(name)
        )`
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
       Fetch User Info
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
       Build Prompt
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
       Tokenize Prompt
    ------------------------------ */
    const inputTokens = encode(prompt);
    const inputSize = prompt.length;
    const tokenSize = inputTokens.length;

    /* ------------------------------
       Insert Input Record
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
       Generate Answer
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

    /* ------------------------------
       Tokenize Output
    ------------------------------ */
    const outputTokens = encode(answer);
    const outputTokenSize = outputTokens.length;

    /* ------------------------------
       Insert Output Record
    ------------------------------ */
    const { error: outputError } = await supabase.from("chat_outputs").insert([
      {
        id: inputRecord.id, // FK to chat_inputs.id
        answer,
        output_tokens: outputTokenSize,
      },
    ]);

    if (outputError) {
      console.error("Error inserting chat_output:", outputError);
      return NextResponse.json(
        { error: "Failed to store chat output" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      answer,
      input_id: inputRecord.id,
      session_id,
      input_tokens: tokenSize,
      output_tokens: outputTokenSize,
    });
  } catch (err) {
    console.error("Error generating answer:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
