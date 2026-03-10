type GenerateTextInput = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
};

function trimSlash(text: string) {
  return text.replace(/\/+$/, '');
}

function parseTimeoutMs(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

export function getLlmConfig() {
  const baseUrl = process.env.STORYFLOW_LLM_BASE_URL || process.env.OPENAI_BASE_URL || '';
  const apiKey = process.env.STORYFLOW_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.STORYFLOW_LLM_MODEL || 'gpt-5.4';
  const timeoutMs = parseTimeoutMs(process.env.STORYFLOW_LLM_TIMEOUT_MS, 180000);

  return {
    baseUrl: trimSlash(baseUrl),
    apiKey,
    model,
    timeoutMs,
    enabled: Boolean(baseUrl && apiKey),
  };
}

export async function generateText(input: GenerateTextInput) {
  const config = getLlmConfig();
  if (!config.enabled) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`timeout:${config.timeoutMs}`), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: input.temperature ?? 0.6,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${config.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
