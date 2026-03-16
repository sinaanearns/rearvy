import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: "test",
});

async function main() {
try{
  const { text } = await streamText({
    model: nvidia.chat('test'),
    messages: [],
    onFinish: async (event) => {
      console.log('onFinish event props:', Object.keys(event));
      if ('response' in event) {
          console.log('response props:', Object.keys((event as any).response));
      } else {
          console.log('no response property!');
      }
    }
  });

  for await (const t of text) {}
} catch (e) { console.log("ERROR", e) }
}
main();
