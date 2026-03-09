type GenerateTextInput = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
};

function trimSlash(text: string) {
  return text.replace(/\/+$/, '');
}

export function getLlmConfig() {
  const baseUrl = process.env.STORYFLOW_LLM_BASE_URL || process.env.OPENAI_BASE_URL || '';
  const apiKey = process.env.STORYFLOW_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.STORYFLOW_LLM_MODEL || 'gpt-5.4';

  return {
    baseUrl: trimSlash(baseUrl),
    apiKey,
    model,
    enabled: Boolean(baseUrl && apiKey),
  };
}

export async function generateText(input: GenerateTextInput) {
  const config = getLlmConfig();
  if (!config.enabled) {
    return null;
  }

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
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}
