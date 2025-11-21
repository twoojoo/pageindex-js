// llm.ts — call_llm implementation
import OpenAI from "openai";

export async function callLLM(
  prompt: string,
  apiKey: string,
  model = "gpt-4.1",
  temperature = 0
): Promise<string> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    temperature,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");

  return content.trim();
}
