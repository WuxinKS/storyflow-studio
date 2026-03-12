import {
  getProviderRuntimeConfig,
  type ProviderChannel,
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

export type ProviderAdapterPreset = {
  label: string;
  requestPath: string;
  responseItemsKey: string;
  batchMode: 'single' | 'batch';
  notes: string[];
  poll: ProviderPollConfig;
};

export type AdapterValueSource = 'env' | 'preset' | 'default';

export type ProviderAdapterSnapshot = ProviderAdapterConfig & {
  provider: ProviderKind;
  channel: ProviderChannel;
  title: string;
  providerName: string;
  providerModel: string;
  presetLabel: string;
  batchMode: 'single' | 'batch';
  notes: string[];
  requestPathSource: AdapterValueSource;
  responseItemsKeySource: AdapterValueSource;
  extraHeadersSource: AdapterValueSource;
  extraBodySource: AdapterValueSource;
  voiceIdSource: AdapterValueSource;
  pollSource: AdapterValueSource;
  pollHasOverrides: boolean;
  usesAsyncPolling: boolean;
  pollSummary: string;
  requestPathPreview: string;
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

const PROVIDER_ORDER: ProviderKind[] = ['image-sequence', 'voice-synthesis', 'video-assembly'];

const COMMON_TASK_ID_KEYS = ['taskId', 'task_id', 'jobId', 'job_id', 'task', 'job', 'requestId', 'request_id', 'id', 'uuid'];
const COMMON_STATUS_URL_KEYS = ['statusUrl', 'status_url', 'pollUrl', 'poll_url', 'retrieveUrl', 'retrieve_url', 'taskUrl', 'task_url', 'resultUrl', 'result_url'];
const COMMON_STATUS_KEYS = ['status', 'state', 'phase', 'taskStatus', 'task_status', 'jobStatus', 'job_status'];
const COMMON_PENDING_VALUES = ['queued', 'pending', 'running', 'processing', 'submitted', 'in_progress', 'starting', 'preparing'];
const COMMON_SUCCESS_VALUES = ['succeeded', 'success', 'completed', 'done', 'finished', 'ready', 'generated'];
const COMMON_FAILURE_VALUES = ['failed', 'error', 'cancelled', 'canceled', 'rejected', 'timed_out', 'timeout', 'expired', 'aborted'];

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

function mergeUniqueStrings(...groups: string[][]) {
  return Array.from(new Set(groups.flat().map((item) => item.trim()).filter(Boolean)));
}

function createPollConfig(overrides: Partial<ProviderPollConfig> = {}): ProviderPollConfig {
  return {
    enabled: false,
    path: '',
    method: 'GET',
    intervalMs: 4000,
    maxAttempts: 12,
    taskIdKeys: COMMON_TASK_ID_KEYS,
    statusUrlKeys: COMMON_STATUS_URL_KEYS,
    statusKeys: COMMON_STATUS_KEYS,
    pendingValues: COMMON_PENDING_VALUES,
    successValues: COMMON_SUCCESS_VALUES,
    failureValues: COMMON_FAILURE_VALUES,
    appendTaskId: false,
    ...overrides,
  };
}

function getProviderHints(provider: ProviderRuntimeConfig) {
  return `${provider.providerName} ${provider.providerModel} ${provider.url}`.toLowerCase();
}

function inferAdapterMode(provider: ProviderRuntimeConfig): ProviderAdapterMode {
  const hints = getProviderHints(provider);

  if (provider.channel === 'image' && (hints.includes('gemini') || hints.includes('generativelanguage'))) return 'gemini-image';
  if (provider.channel === 'image' && (hints.includes('即梦') || hints.includes('jimeng') || hints.includes('seedream') || hints.includes('dreamina'))) return 'jimeng-image';
  if (provider.channel === 'image' && (hints.includes('openai') || hints.includes('gpt-image'))) return 'openai-image';
  if (provider.channel === 'voice' && hints.includes('elevenlabs')) return 'elevenlabs-tts';
  if (provider.channel === 'voice' && (hints.includes('openai') || hints.includes('tts'))) return 'openai-speech';
  if (provider.channel === 'video' && hints.includes('runway')) return 'runway-video';
  if (provider.channel === 'video' && hints.includes('minimax')) return 'minimax-video';
  if (provider.channel === 'video' && hints.includes('kling')) return 'kling-video';
  if (provider.channel === 'video' && hints.includes('seedance')) return 'seedance-video';
  return 'generic-batch';
}

function isAsyncVideoMode(mode: ProviderAdapterMode) {
  return mode === 'runway-video' || mode === 'minimax-video' || mode === 'kling-video' || mode === 'seedance-video';
}

export function getProviderAdapterPreset(mode: ProviderAdapterMode): ProviderAdapterPreset {
  switch (mode) {
    case 'single-item':
      return {
        label: '通用逐条提交',
        requestPath: '',
        responseItemsKey: 'items',
        batchMode: 'single',
        notes: ['会把每条素材拆成独立请求逐个发送，适合非批量接口。'],
        poll: createPollConfig(),
      };
    case 'openai-image':
      return {
        label: 'OpenAI 图像',
        requestPath: '/images/generations',
        responseItemsKey: 'data',
        batchMode: 'single',
        notes: ['默认生成 model + prompt 请求体，适合兼容 OpenAI Images 的网关。'],
        poll: createPollConfig(),
      };
    case 'gemini-image':
      return {
        label: 'Gemini 图像',
        requestPath: '',
        responseItemsKey: 'candidates',
        batchMode: 'single',
        notes: ['会自动拼出 models/<model>:generateContent，并兼容 inlineData 图片返回。'],
        poll: createPollConfig(),
      };
    case 'jimeng-image':
      return {
        label: '即梦 / Seedream 图像',
        requestPath: '',
        responseItemsKey: 'data',
        batchMode: 'single',
        notes: ['适合常见即梦图像网关；若返回 taskId，可继续用 *_POLL_* 覆写为异步回查。'],
        poll: createPollConfig({
          taskIdKeys: mergeUniqueStrings(COMMON_TASK_ID_KEYS, ['generationId', 'generation_id']),
          statusKeys: mergeUniqueStrings(COMMON_STATUS_KEYS, ['progressStatus', 'progress_status']),
        }),
      };
    case 'openai-speech':
      return {
        label: 'OpenAI 语音',
        requestPath: '/audio/speech',
        responseItemsKey: 'data',
        batchMode: 'single',
        notes: ['默认生成 model + voice + input 请求体。'],
        poll: createPollConfig(),
      };
    case 'elevenlabs-tts':
      return {
        label: 'ElevenLabs TTS',
        requestPath: '',
        responseItemsKey: 'audio',
        batchMode: 'single',
        notes: ['若服务端按 voice 路径区分接口，可通过 *_VOICE_ID 和 *_REQUEST_PATH 补齐。'],
        poll: createPollConfig(),
      };
    case 'runway-video':
      return {
        label: 'Runway 视频',
        requestPath: '',
        responseItemsKey: 'data',
        batchMode: 'single',
        notes: ['默认按异步任务处理；若服务直接返回 statusUrl，会优先使用该回查地址。'],
        poll: createPollConfig({
          enabled: true,
          intervalMs: 5000,
          maxAttempts: 18,
          appendTaskId: true,
          taskIdKeys: mergeUniqueStrings(COMMON_TASK_ID_KEYS, ['generationId', 'generation_id']),
          statusUrlKeys: mergeUniqueStrings(COMMON_STATUS_URL_KEYS, ['queryUrl', 'query_url']),
          statusKeys: mergeUniqueStrings(COMMON_STATUS_KEYS, ['progressStatus', 'progress_status']),
        }),
      };
    case 'minimax-video':
      return {
        label: 'MiniMax 视频',
        requestPath: '',
        responseItemsKey: 'data',
        batchMode: 'single',
        notes: ['适合 submit → poll 的视频接口；默认持续回查直到成功、失败或超时。'],
        poll: createPollConfig({
          enabled: true,
          intervalMs: 5000,
          maxAttempts: 18,
          appendTaskId: true,
          taskIdKeys: mergeUniqueStrings(COMMON_TASK_ID_KEYS, ['fileId', 'file_id', 'generationId', 'generation_id']),
          statusUrlKeys: mergeUniqueStrings(COMMON_STATUS_URL_KEYS, ['queryUrl', 'query_url']),
          statusKeys: mergeUniqueStrings(COMMON_STATUS_KEYS, ['fileStatus', 'file_status']),
        }),
      };
    case 'kling-video':
      return {
        label: 'Kling 视频',
        requestPath: '',
        responseItemsKey: 'data',
        batchMode: 'single',
        notes: ['默认启用异步回查，适合视频任务型网关。'],
        poll: createPollConfig({
          enabled: true,
          intervalMs: 5000,
          maxAttempts: 18,
          appendTaskId: true,
          taskIdKeys: mergeUniqueStrings(COMMON_TASK_ID_KEYS, ['generationId', 'generation_id', 'taskUuid']),
          statusKeys: mergeUniqueStrings(COMMON_STATUS_KEYS, ['resultStatus', 'result_status']),
        }),
      };
    case 'seedance-video':
      return {
        label: 'Seedance 视频',
        requestPath: '',
        responseItemsKey: 'data',
        batchMode: 'single',
        notes: ['默认适配 submit → poll 视频链；若状态接口不是 submitEndpoint/{taskId}，请显式填写 *_POLL_PATH。'],
        poll: createPollConfig({
          enabled: true,
          intervalMs: 5000,
          maxAttempts: 18,
          appendTaskId: true,
          taskIdKeys: mergeUniqueStrings(COMMON_TASK_ID_KEYS, ['generationId', 'generation_id']),
          statusUrlKeys: mergeUniqueStrings(COMMON_STATUS_URL_KEYS, ['queryUrl', 'query_url']),
          statusKeys: mergeUniqueStrings(COMMON_STATUS_KEYS, ['progressStatus', 'progress_status']),
        }),
      };
    case 'generic-batch':
    default:
      return {
        label: '通用批量 JSON',
        requestPath: '',
        responseItemsKey: 'items',
        batchMode: 'batch',
        notes: ['适合已经兼容 StoryFlow 批量载荷格式的统一网关。'],
        poll: createPollConfig(),
      };
  }
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

function hasEnvValue(name: string) {
  return normalizeText(process.env[name]).length > 0;
}

function hasAnyEnvValue(names: string[]) {
  return names.some((name) => hasEnvValue(name));
}

function getValueSource(envName: string, presetValue: string): AdapterValueSource {
  if (hasEnvValue(envName)) return 'env';
  if (presetValue) return 'preset';
  return 'default';
}

function buildPollSummary(config: ProviderPollConfig) {
  if (!config.enabled) return '未启用';
  const pathPreview = config.path || (config.appendTaskId ? '{submitEndpoint}/{taskId}' : '{submitEndpoint}');
  return `${config.method} ${pathPreview} · ${config.intervalMs}ms × ${config.maxAttempts}`;
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
  const preset = getProviderAdapterPreset(mode);

  return {
    mode,
    requestPath: pickConfiguredValue(process.env[`${prefix}_REQUEST_PATH`], preset.requestPath),
    responseItemsKey: pickConfiguredValue(process.env[`${prefix}_RESPONSE_ITEMS_KEY`], preset.responseItemsKey),
    extraHeaders: parseStringRecord(process.env[`${prefix}_EXTRA_HEADERS_JSON`]),
    extraBody: parseJsonRecord(process.env[`${prefix}_EXTRA_BODY_JSON`]),
    voiceId: normalizeText(process.env[`${prefix}_VOICE_ID`]),
    poll: {
      enabled: parseBoolean(process.env[`${prefix}_POLL_ENABLED`], preset.poll.enabled),
      path: pickConfiguredValue(process.env[`${prefix}_POLL_PATH`], preset.poll.path),
      method: pickConfiguredValue(process.env[`${prefix}_POLL_METHOD`], preset.poll.method).toUpperCase() === 'POST' ? 'POST' : 'GET',
      intervalMs: parsePositiveInteger(process.env[`${prefix}_POLL_INTERVAL_MS`], preset.poll.intervalMs),
      maxAttempts: parsePositiveInteger(process.env[`${prefix}_POLL_MAX_ATTEMPTS`], preset.poll.maxAttempts),
      taskIdKeys: parseStringList(process.env[`${prefix}_TASK_ID_KEYS`], preset.poll.taskIdKeys),
      statusUrlKeys: parseStringList(process.env[`${prefix}_STATUS_URL_KEYS`], preset.poll.statusUrlKeys),
      statusKeys: parseStringList(process.env[`${prefix}_STATUS_KEYS`], preset.poll.statusKeys),
      pendingValues: parseStringList(process.env[`${prefix}_PENDING_STATUS_VALUES`], preset.poll.pendingValues),
      successValues: parseStringList(process.env[`${prefix}_SUCCEEDED_STATUS_VALUES`], preset.poll.successValues),
      failureValues: parseStringList(process.env[`${prefix}_FAILED_STATUS_VALUES`], preset.poll.failureValues),
      appendTaskId: parseBoolean(process.env[`${prefix}_POLL_APPEND_TASK_ID`], preset.poll.appendTaskId),
    },
  };
}

export function getProviderAdapterSnapshot(provider: ProviderKind): ProviderAdapterSnapshot {
  const runtime = getProviderRuntimeConfig(provider);
  const prefix = getAdapterEnvPrefix(provider);
  const adapter = getProviderAdapterConfig(provider);
  const preset = getProviderAdapterPreset(adapter.mode);
  const pollEnvNames = [
    `${prefix}_POLL_ENABLED`,
    `${prefix}_POLL_PATH`,
    `${prefix}_POLL_METHOD`,
    `${prefix}_POLL_INTERVAL_MS`,
    `${prefix}_POLL_MAX_ATTEMPTS`,
    `${prefix}_TASK_ID_KEYS`,
    `${prefix}_STATUS_URL_KEYS`,
    `${prefix}_STATUS_KEYS`,
    `${prefix}_PENDING_STATUS_VALUES`,
    `${prefix}_SUCCEEDED_STATUS_VALUES`,
    `${prefix}_FAILED_STATUS_VALUES`,
    `${prefix}_POLL_APPEND_TASK_ID`,
  ];

  return {
    ...adapter,
    provider,
    channel: runtime.channel,
    title: runtime.title,
    providerName: runtime.providerName,
    providerModel: runtime.providerModel,
    presetLabel: preset.label,
    batchMode: preset.batchMode,
    notes: preset.notes,
    requestPathSource: getValueSource(`${prefix}_REQUEST_PATH`, preset.requestPath),
    responseItemsKeySource: getValueSource(`${prefix}_RESPONSE_ITEMS_KEY`, preset.responseItemsKey),
    extraHeadersSource: hasEnvValue(`${prefix}_EXTRA_HEADERS_JSON`) ? 'env' : 'default',
    extraBodySource: hasEnvValue(`${prefix}_EXTRA_BODY_JSON`) ? 'env' : 'default',
    voiceIdSource: hasEnvValue(`${prefix}_VOICE_ID`) ? 'env' : 'default',
    pollSource: hasAnyEnvValue(pollEnvNames) ? 'env' : 'preset',
    pollHasOverrides: hasAnyEnvValue(pollEnvNames),
    usesAsyncPolling: adapter.poll.enabled,
    pollSummary: buildPollSummary(adapter.poll),
    requestPathPreview: adapter.requestPath || '(直接使用 Provider URL)',
  };
}

export function listProviderAdapterSnapshots() {
  return PROVIDER_ORDER.map((provider) => getProviderAdapterSnapshot(provider));
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

  if (getProviderAdapterPreset(adapter.mode).batchMode === 'single') {
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
