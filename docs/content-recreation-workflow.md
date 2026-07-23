# Content recreation workflow

Rearvy's content recreation workflow turns a topic plus optional reference frames into an original, editable production plan. It is designed for visual inspiration, shot analysis, prompt creation, and DaVinci Resolve timeline preparation.

## Model routing

The workflow uses the existing NVIDIA router only:

- `NVIDIA_VISION_MODEL` when reference frames are present.
- `NVIDIA_WORKFLOW_MODEL` when planning from a topic or URL alone.
- The router's existing JSON schema validation for every plan response.

The required variables can point to `meta/llama-3.2-11b-vision-instruct`, `z-ai/glm-5.2`, and `moonshotai/kimi-k2.6` as configured in `.env.local`.

## Inputs and output

`POST /api/ai/video-frame-analysis` requires an authenticated Rearvy session and accepts a topic, target niche, optional reference URL, source-use mode, and up to eight PNG, JPEG, or WebP base64 frames. The desktop bridge can pass the current Firebase bearer token as `authorizationToken`. Input is bounded to 8 MB per frame and 24 MB total.

The response contains assumptions, a confidence score, Pinterest search phrases, per-shot original-asset prompts, DaVinci Resolve edit and Fusion notes, and timeline metadata. Invalid requests fail with `400`; unavailable or invalid model responses fail with `503`. Rearvy does not return fabricated shot plans.

## Desktop execution

The `recreateYouTubeVideoFrameByFrame` tool treats a video URL as a planning reference. It produces FCPXML and EDL artifacts for the approved shot plan, creates an asset directory, and launches DaVinci Resolve through the existing approval-gated desktop workflow. Import the FCPXML in Resolve after generated or appropriately licensed assets have been placed in the asset folder.

Source material is not downloaded or copied by this workflow. Use `owned_or_licensed_assets` only when you have the rights to import those local files.
