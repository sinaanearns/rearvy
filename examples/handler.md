# Handler Example

This document shows a minimal example of how an orchestrator can handle OpenAI-style function calls returned by the model.

1. Call the model with `functions` set to the content of `examples/openai_functions.json` and the canonical system prompt.
2. If the model returns a function call, validate `arguments` against the corresponding JSON Schema in `schemas/json_schemas/`.
3. Execute the mapped backend action (create repo, scaffold site, etc.) and return an operation result containing `operation_id` and status.

Pseudo-code (node.js):

```js
// after receiving response from OpenAI
if (response.function_call) {
  const name = response.function_call.name;
  const args = JSON.parse(response.function_call.arguments || '{}');
  // validate args against schema (ajv)
  // run mapped handler
  // return result to user + log
}
```
