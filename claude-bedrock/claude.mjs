import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

const response = await client.send(new InvokeModelCommand({
  modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
  contentType: "application/json",
  accept: "application/json",
  body: JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Say hello and tell me what you can do." }]
  })
}));

const result = JSON.parse(Buffer.from(response.body).toString());
console.log(result.content[0].text);
