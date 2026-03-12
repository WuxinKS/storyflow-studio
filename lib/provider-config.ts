export type ProviderKind = 'image-sequence' | 'voice-synthesis' | 'video-assembly';
export type ProviderChannel = 'image' | 'voice' | 'video';
export type ProviderProfileSource = 'env' | 'inferred' | 'mock-default' | 'missing';
export type ApiKeySource = 'provider' | 'shared' | 'none';

export type ProviderRuntimeConfig = {
  provider: ProviderKind;
  channel: ProviderChannel;
  title: string;
  url: string;
  providerName: string;
  providerModel: string;
  adapter: string;
  nameSource: ProviderProfileSource;
  modelSource: ProviderProfileSource;
  authHeader: string;
  authScheme: string;
  timeoutMs: number;
  apiKey: string;
  apiKeyConfigured: boolean;
  apiKeySource: ApiKeySource;
  apiKeySourceLabel: string;
  nameConfigured: boolean;
  modelConfigured: boolean;
  executionModeHint: 'mock' | 'remote';
};

export type ProviderProfileSnapshot = Omit<ProviderRuntimeConfig, 'apiKey'>;

type ProviderEnvConfig = {
  channel: ProviderChannel;
  title: string;
  urlEnv: string;
  nameEnv: string;
  modelEnv: string;
  apiKeyEnv: string;
  authHeaderEnv: string;
  authSchemeEnv: string;
  timeoutEnv: string;
  mockModel: string;
};

const PROVIDER_ENV_CONFIG: Record<ProviderKind, ProviderEnvConfig> = {
  'image-sequence': {
    channel: 'image',
    title: '图像 Provider',
    urlEnv: 'STORYFLOW_IMAGE_PROVIDER_URL',
    nameEnv: 'STORYFLOW_IMAGE_PROVIDER_NAME',
    modelEnv: 'STORYFLOW_IMAGE_PROVIDER_MODEL',
    apiKeyEnv: 'STORYFLOW_IMAGE_PROVIDER_API_KEY',
    authHeaderEnv: 'STORYFLOW_IMAGE_PROVIDER_AUTH_HEADER',
    authSchemeEnv: 'STORYFLOW_IMAGE_PROVIDER_AUTH_SCHEME',
    timeoutEnv: 'STORYFLOW_IMAGE_PROVIDER_TIMEOUT_MS',
    mockModel: 'image-default',
  },
  'voice-synthesis': {
    channel: 'voice',
    title: '语音 Provider',
    urlEnv: 'STORYFLOW_VOICE_PROVIDER_URL',
    nameEnv: 'STORYFLOW_VOICE_PROVIDER_NAME',
    modelEnv: 'STORYFLOW_VOICE_PROVIDER_MODEL',
    apiKeyEnv: 'STORYFLOW_VOICE_PROVIDER_API_KEY',
    authHeaderEnv: 'STORYFLOW_VOICE_PROVIDER_AUTH_HEADER',
    authSchemeEnv: 'STORYFLOW_VOICE_PROVIDER_AUTH_SCHEME',
    timeoutEnv: 'STORYFLOW_VOICE_PROVIDER_TIMEOUT_MS',
    mockModel: 'voice-default',
  },
  'video-assembly': {
    channel: 'video',
    title: '视频 Provider',
    urlEnv: 'STORYFLOW_VIDEO_PROVIDER_URL',
    nameEnv: 'STORYFLOW_VIDEO_PROVIDER_NAME',
    modelEnv: 'STORYFLOW_VIDEO_PROVIDER_MODEL',
    apiKeyEnv: 'STORYFLOW_VIDEO_PROVIDER_API_KEY',
    authHeaderEnv: 'STORYFLOW_VIDEO_PROVIDER_AUTH_HEADER',
    authSchemeEnv: 'STORYFLOW_VIDEO_PROVIDER_AUTH_SCHEME',
    timeoutEnv: 'STORYFLOW_VIDEO_PROVIDER_TIMEOUT_MS',
    mockModel: 'video-default',
  },
};

const PROVIDER_ORDER: ProviderKind[] = ['image-sequence', 'voice-synthesis', 'video-assembly'];

function trimSlash(text: string) {
  return text.replace(/\/+$/, '');
}

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

function parseTimeoutMs(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function inferProviderName(url: string) {
  if (!url) return '';

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('openai')) return 'OpenAI';
    if (host.includes('fal')) return 'fal';
    if (host.includes('runway')) return 'Runway';
    if (host.includes('replicate')) return 'Replicate';
    if (host.includes('elevenlabs') || host.includes('11labs')) return 'ElevenLabs';
    if (host.includes('minimax')) return 'MiniMax';
    if (host.includes('kling')) return 'Kling';
    if (host.includes('seedance')) return 'Seedance';
    if (host.includes('gemini') || host.includes('generativelanguage')) return 'Gemini';
    if (host.includes('jimeng') || host.includes('seedream') || host.includes('dreamina')) return '即梦';
    if (host.includes('stability')) return 'Stability AI';
    if (host.includes('siliconflow')) return 'SiliconFlow';
    if (host.includes('aliyun') || host.includes('aliyuncs')) return '阿里云';
    if (host.includes('volcengine') || host.includes('doubao') || host.includes('byteplus') || host.includes('bytedance')) return '火山引擎';
    if (host.includes('baidu')) return '百度';

    const segments = host.replace(/^www\./, '').split('.').filter(Boolean);
    if (segments.length >= 2) return segments[segments.length - 2];
    return segments[0] || '';
  } catch {
    return '';
  }
}

export function getProviderRuntimeConfig(provider: ProviderKind): ProviderRuntimeConfig {
  const envConfig = PROVIDER_ENV_CONFIG[provider];
  const sharedApiKey = normalizeText(process.env.STORYFLOW_PROVIDER_API_KEY);
  const sharedAuthHeader = pickConfiguredValue(process.env.STORYFLOW_PROVIDER_AUTH_HEADER, 'Authorization');
  const sharedAuthScheme = pickConfiguredValue(process.env.STORYFLOW_PROVIDER_AUTH_SCHEME, 'Bearer');
  const sharedTimeoutMs = parseTimeoutMs(process.env.STORYFLOW_PROVIDER_TIMEOUT_MS, 300000);

  const url = trimSlash(normalizeText(process.env[envConfig.urlEnv]));
  const explicitName = normalizeText(process.env[envConfig.nameEnv]);
  const explicitModel = normalizeText(process.env[envConfig.modelEnv]);
  const explicitApiKey = normalizeText(process.env[envConfig.apiKeyEnv]);

  const inferredName = inferProviderName(url);
  const executionModeHint = url ? 'remote' : 'mock';
  const providerName = explicitName || inferredName || 'Mock Fallback';
  const providerModel = explicitModel || (url ? '' : envConfig.mockModel);

  const apiKeySource: ApiKeySource = explicitApiKey ? 'provider' : sharedApiKey ? 'shared' : 'none';

  const adapter = normalizeText(process.env[`${envConfig.nameEnv.replace('_NAME', '')}_ADAPTER`]) || '';

  return {
    provider,
    channel: envConfig.channel,
    title: envConfig.title,
    url,
    providerName,
    providerModel,
    adapter,
    nameSource: explicitName ? 'env' : inferredName ? 'inferred' : 'mock-default',
    modelSource: explicitModel ? 'env' : url ? 'missing' : 'mock-default',
    authHeader: pickConfiguredValue(process.env[envConfig.authHeaderEnv], sharedAuthHeader),
    authScheme: pickConfiguredValue(process.env[envConfig.authSchemeEnv], sharedAuthScheme),
    timeoutMs: parseTimeoutMs(process.env[envConfig.timeoutEnv], sharedTimeoutMs),
    apiKey: explicitApiKey || sharedApiKey,
    apiKeyConfigured: Boolean(explicitApiKey || sharedApiKey),
    apiKeySource,
    apiKeySourceLabel: apiKeySource === 'provider' ? '独立 Key' : apiKeySource === 'shared' ? '共享 Key' : '未配置 Key',
    nameConfigured: Boolean(explicitName),
    modelConfigured: Boolean(explicitModel),
    executionModeHint,
  };
}

export function getProviderProfileSnapshot(provider: ProviderKind): ProviderProfileSnapshot {
  const { apiKey: _apiKey, ...snapshot } = getProviderRuntimeConfig(provider);
  return snapshot;
}

export function listProviderRuntimeConfigs() {
  return PROVIDER_ORDER.map((provider) => getProviderRuntimeConfig(provider));
}

export function listProviderProfileSnapshots() {
  return PROVIDER_ORDER.map((provider) => getProviderProfileSnapshot(provider));
}

export function getProviderProfileSnapshotMap() {
  return {
    imageSequence: getProviderProfileSnapshot('image-sequence'),
    voiceSynthesis: getProviderProfileSnapshot('voice-synthesis'),
    videoAssembly: getProviderProfileSnapshot('video-assembly'),
  };
}
