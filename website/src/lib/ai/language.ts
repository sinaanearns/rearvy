export const RESPONSE_LANGUAGE_RULES = `LANGUAGE RULES:
- Reply in English for all user messages unless the user explicitly asks for another language.
- If the latest message mixes languages or the preferred language is unclear, use English.
- Do not mix languages in one answer unless the user asks for translation, bilingual output, or an exact quoted value requires it.
- Never emit hidden reasoning text, chain-of-thought, or tags such as <think>...</think>.
- Exception: When the conversation, route, or request is explicitly for Clicky (for example Clicky pages, Clicky voice generation, or content under the Clicky feature), preserve Clicky's existing language behavior and do NOT force English.`;
