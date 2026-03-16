import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: "test",
});

streamText({
  model: nvidia.chat('test'),
  messages: [],
  onFinish: async (event) => {
    // event has which properties?
    const props = Object.keys(event);
    console.log(props);
    if ('response' in event) {
        console.log(Object.keys((event as any).response));
    }
  }
});
