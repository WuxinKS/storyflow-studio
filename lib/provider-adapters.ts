import {
  getProviderRuntimeConfig,
  type ProviderKind,
  type ProviderRuntimeConfig,
} from '@/lib/provider-config';

type JsonRecord = Record<string, unknown>;

export type ProviderAdapterMode =
  | 'generic-batch'
  | 'single-item'
  | 'openai-image'
  | 'gemini-image'
  | 'jimeng-image'
  | 'openai-speech'
  | 'elevenlabs-tts'
  | 'runway-video'
  | 'minimax-video'
  | 'kling-video'
  | 'seedance-video';

export type ProviderAdapterConfig = {
  mode: ProviderAdapterMode;
  requestPath: string;
  responseItemsKey: string;
  extraHeaders: Record<string, string>;
  extraBody: JsonRecord;
  voiceId: string;
};

export type ProviderAdapterRequest = {
  endpoint: string;
  requestBody: unknown;
  requestHeaders: Record<string, string>;
  responseItemsKey?: string;
  batchMode: 'single' | 'batch';
};

function normalizeText(value: string | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickConfiguredValue(preferred?: string, fallback?: string) {
  const preferredValue = normalizeText(preferred);
  if (preferredValue) return preferredValue;
  const fallbackValue = normalizeText(fallback);
  if (fallbackValue) return fallbackValue;
  return '';
}

function parseJsonRecord(value: string | undefined) {
  const raw = normalizeText(value);
  if (!raw) return {} as JsonRecord;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : {};
  } catch {
    return {} as JsonRecord;
  }
}

function parseStringRecord(value: string | undefined) {
  const parsed = parseJsonRecord(value);
  return Object.fromEntries(
    Object.entries(parsed)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[0].trim().length > 0)
      .map(([key, item]) => [key.trim(), item.trim()]),
  );
}

function trimSlash(text: string) {
  return text.replace(/\/+$/, '');
}

function trimLeadingSlash(text: string) {
  return text.replace(/^\/+/, '');
}

function joinUrl(baseUrl: string, requestPath: string) {
  if (!requestPath) return baseUrl;
  if (/^https?:\/\//i.test(requestPath)) return requestPath;
  if (!baseUrl) return requestPath;
  return `${trimSlash(baseUrl)}/${trimLeadingSlash(requestPath)}`;
}

function buildGeminiEndpoint(baseUrl: string, requestPath: string, providerModel: string) {
  if (requestPath) return joinUrl(baseUrl, requestPath);
  if (!baseUrl) return '';

  const normalizedBase = trimSlash(baseUrl);
  if (/:(generateContent|streamGenerateContent)$/i.test(normalizedBase)) return normalizedBase;
  if (/\/models\/[^/]+$/i.test(normalizedBase)) return `${normalizedBase}:generateContent`;
  if (/\/models$/i.test(normalizedBase)) return `${normalizedBase}/${providerModel || 'gemini-2.0-flash-preview-image-generation'}:generateContent`;
  return `${normalizedBase}/v1beta/models/${providerModel || 'gemini-2.0-flash-preview-image-generation'}:generateContent`;
}

function inferAdapterMode(provider: ProviderRuntimeConfig): ProviderAdapterMode {
  const providerName = provider.providerName.toLowerCase();

  if (provider.channel === 'image' && providerName.includes('gemini')) return 'gemini-image';
  if (provider.channel === 'image' && (providerName.includes('即梦') || providerName.includes('jimeng') || providerName.includes('seedream'))) return 'jimeng-image';
  if (provider.channel === 'image' && providerName.includes('openai')) return 'openai-image';
  if (provider.channel === 'voice' && providerName.includes('elevenlabs')) return 'elevenlabs-tts';
  if (provider.channel === 'voice' && providerName.includes('openai')) return 'openai-speech';
  if (provider.channel === 'video' && providerName.includes('runway')) return 'runway-video';
  if (provider.channel === 'video' && providerName.includes('minimax')) return 'minimax-video';
  if (provider.channel === 'video' && providerName.includes('kling')) return 'kling-video';
  if (provider.channel === 'video' && providerName.includes('seedance')) return 'seedance-video';
  return 'generic-batch';
}

function buildPromptFromItem(item: JsonRecord, fallbackLabel: string) {
  const candidates = [
    item.prompt,
    item.boundReferencePromptLine,
    item.summary,
    item.visualStyle,
    item.audioFocus,
    item.referenceEmotion,
    item.shotTitle,
    item.sceneTitle,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return fallbackLabel;
}

function getAdapterEnvPrefix(provider: ProviderKind) {
  if (provider === 'image-sequence') return 'STORYFLOW_IMAGE_PROVIDER';
  if (provider === 'voice-synthesis') return 'STORYFLOW_VOICE_PROVIDER';
  return 'STORYFLOW_VIDEO_PROVIDER';
}

export function getProviderAdapterConfig(provider: ProviderKind): ProviderAdapterConfig {
  const runtime = getProviderRuntimeConfig(provider);
  const prefix = getAdapterEnvPrefix(provider);
  const mode = pickConfiguredValue(process.env[`${prefix}_ADAPTER`], inferAdapterMode(runtime)) as ProviderAdapterMode;
  const defaultRequestPath = mode === 'openai-image'
    ? '/images/generations'
    : mode === 'gemini-image'
      ? ''
      : mode === 'openai-speech'
        ? '/audio/speech'
        : '';
  const defaultResponseItemsKey = mode === 'openai-image'
    ? 'data'
    : mode === 'gemini-image'
      ? 'candidates'
      : mode === 'jimeng-image'
        ? 'data'
        : mode === 'openai-speech'
          ? 'data'
          : mode === 'elevenlabs-tts'
            ? 'audio'
            : mode === 'runway-video' || mode === 'minimax-video' || mode === 'kling-video' || mode === 'seedance-video'
              ? 'data'
              : 'items';

  return {
    mode,
    requestPath: pickConfiguredValue(process.env[`${prefix}_REQUEST_PATH`], defaultRequestPath),
    responseItemsKey: pickConfiguredValue(process.env[`${prefix}_RESPONSE_ITEMS_KEY`], defaultResponseItemsKey),
    extraHeaders: parseStringRecord(process.env[`${prefix}_EXTRA_HEADERS_JSON`]),
    extraBody: parseJsonRecord(process.env[`${prefix}_EXTRA_BODY_JSON`]),
    voiceId: normalizeText(process.env[`${prefix}_VOICE_ID`]),
  };
}

function buildCommonEnvelope(input: {
  provider: ProviderKind;
  project: { id: string; title: string };
  providerProfile: ProviderRuntimeConfig;
  items: JsonRecord[];
}) {
  return {
    projectId: input.project.id,
    projectTitle: input.project.title,
    provider: input.provider,
    providerName: input.providerProfile.providerName,
    providerModel: input.providerProfile.providerModel || null,
    itemCount: input.items.length,
    items: input.items,
  } satisfies JsonRecord;
}

function mergeRequestHeaders(baseHeaders: Record<string, string>, extraHeaders: Record<string, string>) {
  return {
    ...baseHeaders,
    ...extraHeaders,
  };
}

function toJsonRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function buildOpenAiImageBody(item: JsonRecord, profile: ProviderRuntimeConfig, adapter: ProviderAdapterConfig) {
  return {
    model: profile.providerModel || 'gpt-image-1',
    prompt: buildPromptFromItem(item, '生成一张电影感分镜图像'),
    ...adapter.extraBody,
  } satisfies JsonRecord;
}

function buildGeminiImageBody(item: JsonRecord, profile: ProviderRuntimeConfig, adapter: ProviderAdapterConfig) {
  const extraBody = adapter.extraBody;
  const imageConfig = {
    aspectRatio: typeof extraBody.aspectRatio === 'string' ? extraBody.aspectRatio : '16:9',
    ...(typeof extraBody.imageSize === 'string' ? { imageSize: extraBody.imageSize } : {}),
    ...((extraBody.imageConfig && typeof extraBody.imageConfig === 'object' && !Array.isArray(extraBody.imageConfig))
      ? extraBody.imageConfig as JsonRecord
      : {}),
  } satisfies JsonRecord;

  return {
    model: profile.providerModel || 'gemini-2.0-flash-preview-image-generation',
    contents: [{
      role: 'user',
      parts: [{ text: buildPromptFromItem(item, '生成一张电影感分镜图像') }],
    }],
    generationConfig: {
      responseModalities: ['Image'],
      imageConfig,
      ...extraBody,
    },
  } satisfies JsonRecord;
}

function buildJimengImageBody(item: JsonRecord, profile: ProviderRuntimeConfig, adapter: ProviderAdapterConfig) {
  return {
    model: profile.providerModel || 'seedream-4.0',
    prompt: buildPromptFromItem(item, '生成一张电影感分镜图像'),
    response_format: typeof adapter.extraBody.response_format === 'string' ? adapter.extraBody.response_format : 'url',
    ...adapter.extraBody,
  } satisfies JsonRecord;
}

function buildOpenAiSpeechBody(item: JsonRecord, profile: ProviderRuntimeConfig, adapter: ProviderAdapterConfig) {
  return {
    model: profile.providerModel || 'gpt-4o-mini-tts',
    voice: adapter.voiceId || (typeof adapter.extraBody.voice === 'string' ? adapter.extraBody.voice : 'alloy'),
    input: buildPromptFromItem(item, '请输出该场次的中文旁白与对白语音'),
    ...adapter.extraBody,
  } satisfies JsonRecord;
}

function buildElevenLabsBody(item: JsonRecord, profile: ProviderRuntimeConfig, adapter: ProviderAdapterConfig) {
  return {
    model_id: profile.providerModel || 'eleven_multilingual_v2',
    text: buildPromptFromItem(item, '请输出该场次的中文旁白与对白语音'),
    ...adapter.extraBody,
  } satisfies JsonRecord;
}

function buildVideoPromptBody(item: JsonRecord, profile: ProviderRuntimeConfig, adapter: ProviderAdapterConfig, supplier: string) {
  return {
    model: profile.providerModel || null,
    provider: supplier,
    prompt: buildPromptFromItem(item, '根据当前镜头信息生成一段视频'),
    shotTitle: item.shotTitle || null,
    sceneTitle: item.sceneTitle || null,
    duration: item.plannedDuration || item.targetDuration || null,
    referenceTitles: item.boundReferenceTitles || item.referenceTitles || [],
    ...adapter.extraBody,
  } satisfies JsonRecord;
}

export function buildProviderAdapterRequest(input: {
  provider: ProviderKind;
  project: { id: string; title: string };
  payload: unknown[];
  headers: Record<string, string>;
}) {
  const providerProfile = getProviderRuntimeConfig(input.provider);
  const adapter = getProviderAdapterConfig(input.provider);
  const items = input.payload.map((item) => toJsonRecord(item));
  const endpoint = adapter.mode === 'gemini-image'
    ? buildGeminiEndpoint(providerProfile.url, adapter.requestPath, providerProfile.providerModel)
    : joinUrl(providerProfile.url, adapter.requestPath);
  const headers = mergeRequestHeaders(input.headers, adapter.extraHeaders);

  if (adapter.mode === 'single-item') {
    return {
      endpoint,
      requestBody: items.map((item, index) => ({
        ...buildCommonEnvelope({ provider: input.provider, project: input.project, providerProfile, items: [item] }),
        item,
        index,
      })),
      requestHeaders: headers,
      responseItemsKey: adapter.responseItemsKey,
      batchMode: 'single',
    } satisfies ProviderAdapterRequest;
  }

  if (adapter.mode === 'openai-image') {
    return {
      endpoint,
      requestBody: items.map((item) => buildOpenAiImageBody(item, providerProfile, adapter)),
      requestHeaders: headers,
      responseItemsKey: adapter.responseItemsKey,
      batchMode: 'single',
    } satisfies ProviderAdapterRequest;
  }

  if (adapter.mode === 'gemini-image') {
    return {
      endpoint,
      requestBody: items.map((item) => buildGeminiImageBody(item, providerProfile, adapter)),
      requestHeaders: headers,
      responseItemsKey: adapter.responseItemsKey,
      batchMode: 'single',
    } satisfies ProviderAdapterRequest;
  }

  if (adapter.mode === 'jimeng-image') {
    return {
      endpoint,
      requestBody: items.map((item) => buildJimengImageBody(item, providerProfile, adapter)),
      requestHeaders: headers,
      responseItemsKey: adapter.responseItemsKey,
      batchMode: 'single',
    } satisfies ProviderAdapterRequest;
  }

  if (adapter.mode === 'openai-speech') {
    return {
      endpoint,
      requestBody: items.map((item) => buildOpenAiSpeechBody(item, providerProfile, adapter)),
      requestHeaders: headers,
      responseItemsKey: adapter.responseItemsKey,
      batchMode: 'single',
    } satisfies ProviderAdapterRequest;
  }

  if (adapter.mode === 'elevenlabs-tts') {
    return {
      endpoint,
      requestBody: items.map((item) => buildElevenLabsBody(item, providerProfile, adapter)),
      requestHeaders: headers,
      responseItemsKey: adapter.responseItemsKey,
      batchMode: 'single',
    } satisfies ProviderAdapterRequest;
  }

  if (adapter.mode === 'runway-video' || adapter.mode === 'minimax-video' || adapter.mode === 'kling-video' || adapter.mode === 'seedance-video') {
    return {
      endpoint,
      requestBody: items.map((item) => buildVideoPromptBody(item, providerProfile, adapter, adapter.mode)),
      requestHeaders: headers,
      responseItemsKey: adapter.responseItemsKey,
      batchMode: 'single',
    } satisfies ProviderAdapterRequest;
  }

  return {
    endpoint,
    requestBody: {
      ...buildCommonEnvelope({ provider: input.provider, project: input.project, providerProfile, items }),
      ...adapter.extraBody,
    },
    requestHeaders: headers,
    responseItemsKey: adapter.responseItemsKey,
    batchMode: 'batch',
  } satisfies ProviderAdapterRequest;
}

export function normalizeAdapterResponse(responseBody: unknown, request: ProviderAdapterRequest) {
  if (request.batchMode === 'batch') return responseBody;
  if (!Array.isArray(request.requestBody)) return responseBody;

  const responses = Array.isArray(responseBody)
    ? responseBody
    : [responseBody];

  return {
    mode: 'remote',
    itemCount: responses.length,
    items: responses,
    [request.responseItemsKey || 'items']: responses,
  } satisfies JsonRecord;
}
