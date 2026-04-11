import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const ClassificationSchema = z.object({
  category: z.enum(["pre_sale", "support", "order_update", "complaint", "other"]),
  intent_signals: z.array(z.string()),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  summary: z.string().describe("A brief 1-sentence summary of the email's core message"),
});

export type EmailClassification = z.infer<typeof ClassificationSchema>;

/**
 * Classifies a Gmail message using AI to extract category, intent, and sentiment.
 */
export async function classifyEmail(params: {
  subject: string;
  body: string;
  from: string;
}): Promise<EmailClassification> {
  const kimiApiKey = process.env.Kimi?.trim();
  if (!kimiApiKey) {
    throw new Error("Kimi API key is not configured.");
  }

  const nvidia = createOpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: kimiApiKey,
  });

  // Use Kimi or a reliable instruct model via NVIDIA NIM
  const model = nvidia.chat("moonshotai/kimi-k2-instruct");

  const prompt = `
    You are an expert business communication analyst for Rearvy, an AI business advisor.
    Your task is to classify an incoming customer email to help correlate it with revenue outcomes.

    EMAIL CONTENT:
    From: ${params.from}
    Subject: ${params.subject}
    Body:
    ${params.body.slice(0, 2000)} // Truncate to avoid context window issues

    INSTRUCTIONS:
    1. Categorize the email into one of:
       - pre_sale: Inquiries before purchase (e.g., pricing, features, "when in stock?").
       - support: Help with using the product, technical issues.
       - order_update: Questions about shipping, tracking, changes to existing orders.
       - complaint: Dissatisfied customers, requests for refunds or returns.
       - other: Newsletter, spam, or miscellaneous.
    2. Extract intent signals: Specific business-relevant actions or needs (e.g., "inventory_demand", "refund_requested", "shipping_delay", "pricing_inquiry").
    3. Analyze sentiment: positive, neutral, or negative.
    4. Provide a 1-sentence summary.

    Respond with a valid JSON object.
  `;

  try {
    const { object } = await generateObject({
      model,
      schema: ClassificationSchema,
      prompt,
    });

    return object;
  } catch (error) {
    console.error("Email classification failed:", error);
    // Fallback to safe defaults
    return {
      category: "other",
      intent_signals: [],
      sentiment: "neutral",
      summary: "Classification failed due to an error.",
    };
  }
}
