import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { aiCompletionService } from "@/lib/ai/model-router";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { generateStructuredConnectorBrief } from "@/lib/rearvy-connectors/brief-generator";

export const runtime = "nodejs";

const log = createServerLogger("RefineConnectorBriefApi");

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  try {
    const body = await readJsonRecord(request);
    const platformType = typeof body.platformType === "string" ? body.platformType.trim() : "Website";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!description) {
      return NextResponse.json(
        { error: "Description is required to generate a connector brief." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a Principal AI Architect and Systems Engineer at Rearvy.
Your job is to take a business or developer's rough, informal description of their website, app, or service and transform it into a crystal-clear, highly detailed, enterprise-grade Connector Brief & AI Specification in Markdown format (to be saved as 'rearvy.capabilities.md' or added to project plans).

Follow this exact structure:
# Rearvy Connector Brief & AI Specification

## 1. Platform Overview
- **Platform Name**: [Extract platform name or domain from input, e.g. Cliping.com]
- **Platform Type**: ${platformType}
- **Source Visibility**: Private (Zero source code, internal logic, or credentials exposed to Rearvy)
- **Target Specification Artifact**: \`rearvy.capabilities.md\`

## 2. Core Value Proposition & Scope
[Write a crisp, professional 2-3 sentence overview of what this platform does and the value it brings when connected to Rearvy]

## 3. Discovered External Capabilities & Action Contract
[Extract every capability from the user's description into structured action blocks. Fix all spelling, grammar, and ambiguities. For each action item, format like this:
### Capability X: [Concise Action Title]
- **Action ID**: \`[camelCase_or_snake_case_id]\`
- **Description**: [Precise explanation of what this action does]
- **Inputs**: [Expected input parameters, e.g. videoUrl, templateId, channelList]
- **Outputs**: [Expected return data or assets, e.g. clippedMediaUrl, status, jobId]
- **Execution Mode**: Sandboxed external action
- **Approval Policy**: [Automated read/query OR Human approval required before execution for writes/uploads/edits/transactions]
]

## 4. Integration & Security Blueprint
1. **Private Adapter Implementation**: Implement a sandboxed adapter interface within the host codebase with typed JSON schemas.
2. **Permission Boundary & Scopes**: Restrict remote invocation strictly to authorized capability IDs.
3. **Human-in-the-Loop Safeguards**: Require explicit user confirmation in the Rearvy dashboard before committing outbound uploads, video edits, or publishing.
4. **Sandbox & Regression Testing**: Run automated test suites against mock inputs before requesting connector activation.
5. **Zero-Trust Data Policy**: Do not transmit proprietary source code, database credentials, or customer PII to Rearvy.

## 5. Instructions for AI Coding Agents (Cursor / Claude / Copilot)
- Read \`rearvy.capabilities.md\` to understand the external integration surface.
- Keep adapter code separate from the host application's core business logic.
- Ensure all inputs and outputs strictly validate against the defined JSON schema contracts.

Do not wrap the whole response in a markdown code fence; return raw markdown. Fix all user typos and formatting mistakes into professional engineering standards.`;

    const userPrompt = `Platform Type: ${platformType}
User Description / Raw Prompt:
"${description}"

Please refine this into an enterprise-grade Connector Brief & AI Specification following the required structure.`;

    let briefOutput = "";
    let isAiRefined = false;

    try {
      const aiResult = await aiCompletionService.generateText({
        task: "deep_business_reasoning",
        system: systemPrompt,
        prompt: userPrompt,
        userId: user.uid,
        timeoutMs: 25_000,
      });

      if (aiResult?.text && !aiResult.aiUnavailable) {
        briefOutput = aiResult.text.trim();
        // If the model wrapped the entire response in triple backticks, unwrap it
        if (briefOutput.startsWith("```markdown") && briefOutput.endsWith("```")) {
          briefOutput = briefOutput.slice(11, -3).trim();
        } else if (briefOutput.startsWith("```") && briefOutput.endsWith("```")) {
          briefOutput = briefOutput.slice(3, -3).trim();
        }
        isAiRefined = true;
      } else {
        briefOutput = generateStructuredConnectorBrief(platformType, description);
      }
    } catch (aiErr) {
      log.warn("AI generation error, falling back to deterministic brief generator:", aiErr);
      briefOutput = generateStructuredConnectorBrief(platformType, description);
    }

    return NextResponse.json({
      brief: briefOutput || generateStructuredConnectorBrief(platformType, description),
      isAiRefined,
    });
  } catch (err) {
    if (isRequestBodyError(err)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    log.error("Refine connector brief error:", err);
    return NextResponse.json(
      { error: "Failed to generate connector brief." },
      { status: 500 }
    );
  }
}
