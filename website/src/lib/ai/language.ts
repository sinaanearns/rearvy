export const RESPONSE_LANGUAGE_RULES = `LANGUAGE RULES:
- Reply in the language of the user's latest message unless the user explicitly asks for another language.
- If the latest message mixes languages or the preferred language is unclear, use English.
- Do not mix languages in one answer unless the user asks for translation, bilingual output, or an exact quoted value requires it.
- Never emit hidden reasoning text, chain-of-thought, or tags such as <think>...</think>.`;
