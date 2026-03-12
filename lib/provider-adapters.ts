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

export type ProviderPollConfig = {
  enabled: boolean;
  path: string;
  method: 'GET' | 'POST';
  intervalMs: number;
  maxAttempts: number;
  taskIdKeys: string[];
  statusUrlKeys: string[];
  statusKeys: string[];
  pendingValues: string[];
  successValues: string[];
  failureValues: string[];
  appendTaskId: boolean;
};

export type ProviderAdapterConfig = {
  mode: ProviderAdapterMode;
  requestPath: string;
  responseItemsKey: string;
  extraHeaders: Record<string, string>;
  extraBody: JsonRecord;
  voiceId: string;
  poll: ProviderPollConfig;
};

export type ProviderAdapterRequest = {
  endpoint: string;
  requestBody: unknown;
  requestHeaders: Record<string, string>;
  responseItemsKey?: string;
  batchMode: 'single' | 'batch';
};

export type ProviderPollRequest = {
  endpoint: string;
  method: 'GET' | 'POST';
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
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

function parseStringList(value: string | undefined, fallback: string[]) {
  const raw = normalizeText(value);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const values = parsed.map((item) => String(item).trim()).filter(Boolean);
      return values.length > 0 ? values : fallback;
    }
  } catch {
    // ignore and fall back to comma-separated parsing
  }

  const values = raw.split(',').map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
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

function isAsyncVideoMode(mode: ProviderAdapterMode) {
  return mode === 'runway-video' || mode === 'minimax-video' || mode === 'kling-video' || mode === 'seedance-video';
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

function buildProviderEndpoint(profile: ProviderRuntimeConfig, adapter: ProviderAdapterConfig) {
  return adapter.mode === 'gemini-image'
    ? buildGeminiEndpoint(profile.url, adapter.requestPath, profile.providerModel)
    : joinUrl(profile.url, adapter.requestPath);
}

function buildPollEndpoint(input: {
  providerProfile: ProviderRuntimeConfig;
  adapter: ProviderAdapterConfig;
  taskId?: string;
  overrideUrl?: string;
}) {
  const overrideUrl = normalizeText(input.overrideUrl);
  if (overrideUrl) {
    return /^https?:\/\//i.test(overrideUrl)
      ? overrideUrl
      : joinUrl(input.providerProfile.url, overrideUrl);
  }

  const rawPollPath = input.adapter.poll.path;
  const submitEndpoint = buildProviderEndpoint(input.providerProfile, input.adapter);
  if (!rawPollPath) {
    if (!input.taskId || !input.adapter.poll.appendTaskId) return submitEndpoint;
    return `${trimSlash(submitEndpoint)}/${encodeURIComponent(input.taskId)}`;
  }

  const replaced = rawPollPath
    .replace(/\{taskId\}/g, input.taskId || '')
    .replace(/\{task_id\}/g, input.taskId || '')
    .replace(/\{jobId\}/g, input.taskId || '')
    .replace(/\{id\}/g, input.taskId || '');

  const baseEndpoint = /^https?:\/\//i.test(replaced)
    ? replaced
    : joinUrl(input.providerProfile.url, replaced);

  if (!input.taskId || replaced !== rawPollPath || !input.adapter.poll.appendTaskId) return baseEndpoint;
  return `${trimSlash(baseEndpoint)}/${encodeURIComponent(input.taskId)}`;
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
            : isAsyncVideoMode(mode)
              ? 'data'
              : 'items';
  const asyncByDefault = isAsyncVideoMode(mode);

  return {
    mode,
    requestPath: pickConfiguredValue(process.env[`${prefix}_REQUEST_PATH`], defaultRequestPath),
    responseItemsKey: pickConfiguredValue(process.env[`${prefix}_RESPONSE_ITEMS_KEY`], defaultResponseItemsKey),
    extraHeaders: parseStringRecord(process.env[`${prefix}_EXTRA_HEADERS_JSON`]),
    extraBody: parseJsonRecord(process.env[`${prefix}_EXTRA_BODY_JSON`]),
    voiceId: normalizeText(process.env[`${prefix}_VOICE_ID`]),
    poll: {
      enabled: parseBoolean(process.env[`${prefix}_POLL_ENABLED`], asyncByDefault),
      path: normalizeText(process.env[`${prefix}_POLL_PATH`]),
      method: pickConfiguredValue(process.env[`${prefix}_POLL_METHOD`], 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET',
      intervalMs: parsePositiveInteger(process.env[`${prefix}_POLL_INTERVAL_MS`], 4000),
      maxAttempts: parsePositiveInteger(process.env[`${prefix}_POLL_MAX_ATTEMPTS`], 12),
      taskIdKeys: parseStringList(process.env[`${prefix}_TASK_ID_KEYS`], ['taskId', 'task_id', 'jobId', 'job_id', 'task', 'id', 'uuid']),
      statusUrlKeys: parseStringList(process.env[`${prefix}_STATUS_URL_KEYS`], ['statusUrl', 'status_url', 'pollUrl', 'poll_url', 'retrieveUrl', 'retrieve_url', 'taskUrl', 'task_url']),
      statusKeys: parseStringList(process.env[`${prefix}_STATUS_KEYS`], ['status', 'state', 'phase', 'taskStatus', 'task_status']),
      pendingValues: parseStringList(process.env[`${prefix}_PENDING_STATUS_VALUES`], ['queued', 'pending', 'running', 'processing', 'submitted', 'in_progress']),
      successValues: parseStringList(process.env[`${prefix}_SUCCEEDED_STATUS_VALUES`], ['succeeded', 'success', 'completed', 'done', 'finished', 'ready']),
      failureValues: parseStringList(process.env[`${prefix}_FAILED_STATUS_VALUES`], ['failed', 'error', 'cancelled', 'canceled']),
      appendTaskId: parseBoolean(process.env[`${prefix}_POLL_APPEND_TASK_ID`], asyncByDefault),
    },
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
  const endpoint = buildProviderEndpoint(providerProfile, adapter);
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

  if (isAsyncVideoMode(adapter.mode)) {
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

export function buildProviderPollRequest(input: {
  provider: ProviderKind;
  taskId?: string;
  headers: Record<string, string>;
  overrideUrl?: string;
}) {
  const providerProfile = getProviderRuntimeConfig(input.provider);
  const adapter = getProviderAdapterConfig(input.provider);
  if (!adapter.poll.enabled) return null;

  const endpoint = buildPollEndpoint({
    providerProfile,
    adapter,
    taskId: input.taskId,
    overrideUrl: input.overrideUrl,
  });

  if (!endpoint) return null;

  return {
    endpoint,
    method: adapter.poll.method,
    requestHeaders: mergeRequestHeaders(input.headers, adapter.extraHeaders),
    requestBody: adapter.poll.method === 'POST'
      ? {
          id: input.taskId || null,
          taskId: input.taskId || null,
          task_id: input.taskId || null,
          jobId: input.taskId || null,
          job_id: input.taskId || null,
        }
      : undefined,
  } satisfies ProviderPollRequest;
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
