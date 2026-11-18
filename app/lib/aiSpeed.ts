// Round 68: OpenRouter settings that make the photo read faster. Only the photo/text meal read uses them
// (Gemini's thinking cannot be switched off, but "low" keeps it short; 3000 tokens leaves room so the answer is never cut off).
export const FAST_VISION_OPTS = { reasoning: { effort: "low" }, max_tokens: 3000, provider: { sort: "latency" } } as const;
