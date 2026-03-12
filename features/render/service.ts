import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '@/lib/prisma';
import { parseVisualBibleDraft, type VisualBibleDraft } from '@/features/visual/service';
import { parseCharacterDrafts, type CharacterDraft } from '@/features/characters/service';
import { buildReferenceBindingSnapshot, buildReferenceProfile, getReferenceInsights } from '@/features/reference/service';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';
import { getTimelineBundle } from '@/features/timeline/service';
import { getFinalCutPlan } from '@/features/final-cut/service';
import { getLatestOutlineByTitle } from '@/lib/outline-store';
import {
  getGeneratedMediaEntries,
  replaceGeneratedMediaEntriesForProvider,
  type GeneratedMediaEntry,
  type GeneratedMediaType,
} from '@/features/media/service';
import {
  getProviderProfileSnapshot,
  getProviderProfileSnapshotMap,
  getProviderRuntimeConfig,
  type ProviderKind,
} from '@/lib/provider-config';
import {
  buildProviderAdapterRequest,
  buildProviderPollRequest,
  getProviderAdapterConfig,
  normalizeAdapterResponse,
} from '@/lib/provider-adapters';

const execFileAsync = promisify(execFile);

type RenderExecutionMode = 'mock' | 'remote';

export type RenderJobQuery = {
  provider?: ProviderKind;
  jobId?: string;
};

type PendingRenderTask = {
  index: number;
  taskId?: string;
  status?: string;
  pollUrl?: string;
};

type RenderJobMeta = {
  version: 1 | 2;
  mode: RenderExecutionMode;
  retryCount: number;
  payloadCount: number;
  summary: string[];
  endpoint?: string;
  requestPath?: string;
  responsePath?: string;
  lastError?: string;
  preview?: string;
  executedAt?: string;
  assetCount?: number;
  artifactIndexPath?: string;
  timeoutMs?: number;
  providerName?: string;
  providerModel?: string;
  adapter?: string;
  pollPath?: string;
  pollTracePath?: string;
  pollAttempts?: number;
  taskStatus?: string;
  pendingTasks?: PendingRenderTask[];
};

const DEFAULT_JOB_META: RenderJobMeta = {
  version: 2,
  mode: 'mock',
  retryCount: 0,
  payloadCount: 0,
  summary: [],
  pendingTasks: [],
};

function hasReferenceFlavor(text: string | null) {
  if (!text) return false;
  return text.includes('参考构图') || text.includes('情绪参考') || text.includes('动作节奏参考');
}

function summarizeShotKinds(titles: string[]) {
  const counts = new Map<string, number>();
  for (const title of titles) {
    const kind = getShotKindFromTitle(title);
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([kind, count]) => `${kind}:${count}`)
    .join(',');
}

function slugifyProjectTitle(title: string) {
  return title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'project';
}

function timestampTag() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getVisualBible(project: { outlines?: Array<{ title: string; summary: string }> }): VisualBibleDraft | null {
  const outline = project.outlines ? getLatestOutlineByTitle(project.outlines, 'Visual Bible') : null;
  return outline ? parseVisualBibleDraft(outline.summary) : null;
}

function getCharacterDrafts(project: { outlines?: Array<{ title: string; summary: string }> }): CharacterDraft[] {
  const outline = project.outlines ? getLatestOutlineByTitle(project.outlines, 'Character Drafts') : null;
  return outline ? parseCharacterDrafts(outline.summary) : [];
}

function summarizeCharacters(characters: CharacterDraft[]) {
  if (characters.length === 0) return '暂无角色草案';
  return characters.map((item) => `${item.name}（${item.role}）`).join(' / ');
}

function mergeVisualStyle(base: string, visualBible: VisualBibleDraft | null) {
  if (!visualBible) return base;
  return `${base} | palette: ${visualBible.palette} | tone: ${visualBible.visualTone}`;
}

function mergeCameraMotion(base: string, visualBible: VisualBibleDraft | null) {
  if (!visualBible) return base;
  return `${base} | motion rule: ${visualBible.motionLanguage}`;
}

function mergeEmphasis(base: string, visualBible: VisualBibleDraft | null, characterSummary: string) {
  const visualPart = !visualBible ? base : `${base} | lens: ${visualBible.lensLanguage} | texture: ${visualBible.textureKeywords}`;
  if (!characterSummary || characterSummary === '暂无角色草案') return visualPart;
  return `${visualPart} | characters: ${characterSummary}`;
}

function buildAudioFocus(kind: string, visualBible: VisualBibleDraft | null, characterSummary: string, base: string) {
  const stylePart = !visualBible ? base : `${base} | style cue: ${visualBible.styleName} | scene feel: ${kind}`;
  if (!characterSummary || characterSummary === '暂无角色草案') return stylePart;
  return `${stylePart} | character cue: ${characterSummary}`;
}

export type ShotRenderPreset = {
  shotId: string;
  shotTitle: string;
  kind: string;
  visualStyle: string;
  cameraMotion: string;
  pacing: string;
  emphasis: string;
  audioFocus: string;
  characterSummary?: string;
  visualBibleStyle?: string;
  palette?: string;
  lighting?: string;
  lensLanguage?: string;
  motionLanguage?: string;
  textureKeywords?: string;
  referenceTitles?: string[];
  referencePromptLine?: string;
  referenceBindingNote?: string;
};

export function getRenderPresetForShot(
  shot: { id: string; title: string; prompt: string | null; cameraNotes: string | null },
  visualBible: VisualBibleDraft | null = null,
  characters: CharacterDraft[] = [],
  referenceCue: { promptLine?: string | null; titles?: string[]; note?: string | null } | null = null,
): ShotRenderPreset {
  const kind = getShotKindFromTitle(shot.title);
  const characterSummary = summarizeCharacters(characters);
  const referenceTitles = Array.isArray(referenceCue?.titles)
    ? referenceCue.titles.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const referencePromptLine = referenceCue?.promptLine ? String(referenceCue.promptLine).trim() : '';
  const referenceBindingNote = referenceCue?.note ? String(referenceCue.note).trim() : '';
  const referenceSuffix = referenceTitles.length > 0
    ? ' | targeted reference: ' + referenceTitles.slice(0, 3).join(' / ')
    : referencePromptLine
      ? ' | targeted reference: ' + referencePromptLine
      : '';

  const presetMap: Record<string, Omit<ShotRenderPreset, 'shotId' | 'shotTitle' | 'kind'>> = {
    空间建立: {
      visualStyle: 'wide cinematic environment',
      cameraMotion: 'slow push or slow pan',
      pacing: 'slow-open',
      emphasis: 'space relation and staging',
      audioFocus: 'ambient hum and scene atmosphere',
    },
    细节观察: {
      visualStyle: 'macro close-up with texture emphasis',
      cameraMotion: 'micro move / focus pull',
      pacing: 'tight-observation',
      emphasis: 'object detail and noticing process',
      audioFocus: 'small tactile sounds and breathing',
    },
    感官压迫: {
      visualStyle: 'tight framing with flicker contrast',
      cameraMotion: 'subtle shake / pressure drift',
      pacing: 'pressure-build',
      emphasis: 'sensory stress and environmental threat',
      audioFocus: 'alarm, rumble, pressure noise',
    },
    情绪落点: {
      visualStyle: 'close-up emotional isolation',
      cameraMotion: 'still hold',
      pacing: 'linger-on-emotion',
      emphasis: 'face, breath, emotional residue',
      audioFocus: 'breath, silence, emotional tail',
    },
    关系压迫: {
      visualStyle: 'compressed over-shoulder confrontation',
      cameraMotion: 'push-in tension',
      pacing: 'locked-tension',
      emphasis: 'eyeline pressure and distance conflict',
      audioFocus: 'silence under tension and reactive movement',
    },
    动作触发: {
      visualStyle: 'action-first directional framing',
      cameraMotion: 'dynamic reframing',
      pacing: 'trigger-acceleration',
      emphasis: 'decision point and motion start',
      audioFocus: 'impact cues and motion hits',
    },
    对白博弈: {
      visualStyle: 'shot-reverse-shot reaction framing',
      cameraMotion: 'controlled conversational cadence',
      pacing: 'dialogue-pressure',
      emphasis: 'spoken power shift and reaction timing',
      audioFocus: 'voice dynamics and silence between lines',
    },
  };

  const base = presetMap[kind] || {
    visualStyle: 'balanced cinematic framing',
    cameraMotion: 'moderate camera movement',
    pacing: 'default',
    emphasis: 'general narrative beat',
    audioFocus: 'general ambience',
  };

  return {
    shotId: shot.id,
    shotTitle: shot.title,
    kind,
    visualStyle: mergeVisualStyle(base.visualStyle, visualBible) + referenceSuffix,
    cameraMotion: mergeCameraMotion(base.cameraMotion, visualBible) + (referencePromptLine ? ' | ref motion cue: ' + referencePromptLine : ''),
    pacing: base.pacing,
    emphasis: mergeEmphasis(base.emphasis, visualBible, characterSummary) + referenceSuffix,
    audioFocus: buildAudioFocus(kind, visualBible, characterSummary, base.audioFocus) + (referenceBindingNote ? ' | binding note: ' + referenceBindingNote : referenceSuffix),
    characterSummary,
    visualBibleStyle: visualBible?.styleName,
    palette: visualBible?.palette,
    lighting: visualBible?.lighting,
    lensLanguage: visualBible?.lensLanguage,
    motionLanguage: visualBible?.motionLanguage,
    textureKeywords: visualBible?.textureKeywords,
    referenceTitles,
    referencePromptLine: referencePromptLine || undefined,
    referenceBindingNote: referenceBindingNote || undefined,
  };
}
function safeJsonParse(text: string | null | undefined) {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function parseRenderJobOutput(outputUrl: string | null) {
  const parsed = safeJsonParse(outputUrl);
  if (parsed && typeof parsed === 'object' && 'version' in parsed) {
    const meta = parsed as Partial<RenderJobMeta>;
    return {
      ...DEFAULT_JOB_META,
      ...meta,
      summary: Array.isArray(meta.summary) ? meta.summary.map((item) => String(item)) : [],
      pendingTasks: Array.isArray(meta.pendingTasks)
        ? meta.pendingTasks.map((item, index) => {
            const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
            return {
              index: typeof record.index === 'number' ? record.index : index,
              taskId: typeof record.taskId === 'string' && record.taskId.trim() ? record.taskId.trim() : undefined,
              status: typeof record.status === 'string' && record.status.trim() ? record.status.trim() : undefined,
              pollUrl: typeof record.pollUrl === 'string' && record.pollUrl.trim() ? record.pollUrl.trim() : undefined,
            } satisfies PendingRenderTask;
          })
        : [],
    } satisfies RenderJobMeta;
  }

  if (!outputUrl) return DEFAULT_JOB_META;
  return {
    ...DEFAULT_JOB_META,
    summary: outputUrl.split('|').filter(Boolean),
  } satisfies RenderJobMeta;
}

function serializeRenderJobOutput(meta: Partial<RenderJobMeta>) {
  return JSON.stringify({
    ...DEFAULT_JOB_META,
    ...meta,
    summary: meta.summary || [],
    pendingTasks: Array.isArray(meta.pendingTasks) ? meta.pendingTasks : [],
  } satisfies RenderJobMeta);
}

function getProviderEndpoint(provider: ProviderKind) {
  return getProviderRuntimeConfig(provider).url || null;
}

function getProviderApiKey(provider: ProviderKind) {
  return getProviderRuntimeConfig(provider).apiKey;
}

function getProviderAuthHeader(provider: ProviderKind) {
  return getProviderRuntimeConfig(provider).authHeader || 'Authorization';
}

function getProviderAuthScheme(provider: ProviderKind) {
  return getProviderRuntimeConfig(provider).authScheme || 'Bearer';
}

function getProviderTimeoutMs(provider: ProviderKind) {
  return getProviderRuntimeConfig(provider).timeoutMs;
}

function buildProviderHeaders(provider: ProviderKind) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = getProviderApiKey(provider);
  if (!apiKey) return headers;

  const authHeader = getProviderAuthHeader(provider);
  const authScheme = getProviderAuthScheme(provider);
  headers[authHeader] = /^(raw|none)$/i.test(authScheme) ? apiKey : `${authScheme} ${apiKey}`.trim();
  return headers;
}

const REMOTE_INLINE_DATA_KEYS = ['inlineData', 'inline_data'];
const REMOTE_SOURCE_KEYS = ['url', 'outputUrl', 'sourceUrl', 'imageUrl', 'videoUrl', 'audioUrl', 'downloadUrl', 'uri', 'src', 'href'];
const REMOTE_LOCAL_KEYS = ['localPath', 'path', 'filePath', 'outputPath', 'destination', 'savePath', 'targetPath'];
const VOLATILE_SUMMARY_PREFIXES = ['status:', 'pendingTasks:', 'pollAttempts:', 'pollPath:', 'assets:', 'lastTaskStatus:'];

type ProviderAsyncTraceEntry = {
  attempt: number;
  endpoint: string;
  status: number | null;
  preview: string;
  taskId?: string;
  taskStatus?: string | null;
  checkedAt: string;
};

type ProviderAsyncResolution = {
  lifecycle: 'completed' | 'pending';
  responseBody: unknown;
  preview: string;
  pollAttempts: number;
  pollPath: string | null;
  pendingTask: PendingRenderTask | null;
  taskStatus: string | null;
  trace: ProviderAsyncTraceEntry[];
};

function toLooseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function pickTextDeepLoose(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = pickTextDeepLoose(item, keys, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  const record = toLooseRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  for (const nested of Object.values(record)) {
    const resolved = pickTextDeepLoose(nested, keys, depth + 1);
    if (resolved) return resolved;
  }

  return null;
}

function hasImmediateMediaArtifact(value: unknown, depth = 0): boolean {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((item) => hasImmediateMediaArtifact(item, depth + 1));

  const record = toLooseRecord(value);
  for (const key of REMOTE_SOURCE_KEYS.concat(REMOTE_LOCAL_KEYS)) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return true;
  }

  for (const key of REMOTE_INLINE_DATA_KEYS) {
    const node = toLooseRecord(record[key]);
    if (typeof node.data === 'string' && node.data.trim()) return true;
  }

  return Object.values(record).some((item) => hasImmediateMediaArtifact(item, depth + 1));
}

function summarizeRemotePreview(value: unknown) {
  if (typeof value === 'string') return value.trim().slice(0, 180);
  try {
    return JSON.stringify(value).slice(0, 180);
  } catch {
    return String(value).slice(0, 180);
  }
}

function normalizeStatusToken(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || null;
}

function matchesStatus(status: string | null, values: string[]) {
  const normalizedStatus = normalizeStatusToken(status);
  if (!normalizedStatus) return false;
  return values.some((item) => normalizeStatusToken(item) === normalizedStatus);
}

function classifyAsyncResponse(input: {
  adapterConfig: ReturnType<typeof getProviderAdapterConfig>;
  responseBody: unknown;
  index: number;
  pendingHint?: PendingRenderTask | null;
}) {
  const taskId = pickTextDeepLoose(input.responseBody, input.adapterConfig.poll.taskIdKeys) || input.pendingHint?.taskId;
  const statusText = pickTextDeepLoose(input.responseBody, input.adapterConfig.poll.statusKeys) || input.pendingHint?.status || null;
  const pollUrl = pickTextDeepLoose(input.responseBody, input.adapterConfig.poll.statusUrlKeys) || input.pendingHint?.pollUrl;
  const pendingTask = {
    index: input.index,
    taskId: taskId || undefined,
    status: statusText || undefined,
    pollUrl: pollUrl || undefined,
  } satisfies PendingRenderTask;

  if (!input.adapterConfig.poll.enabled) {
    return {
      state: 'completed' as const,
      pendingTask: null,
      statusText,
    };
  }

  if (matchesStatus(statusText, input.adapterConfig.poll.failureValues)) {
    return {
      state: 'failed' as const,
      pendingTask,
      statusText,
    };
  }

  if (matchesStatus(statusText, input.adapterConfig.poll.pendingValues)) {
    return {
      state: 'pending' as const,
      pendingTask,
      statusText,
    };
  }

  if (matchesStatus(statusText, input.adapterConfig.poll.successValues) || hasImmediateMediaArtifact(input.responseBody)) {
    return {
      state: 'completed' as const,
      pendingTask: null,
      statusText,
    };
  }

  if (pendingTask.taskId || pendingTask.pollUrl) {
    return {
      state: 'pending' as const,
      pendingTask,
      statusText,
    };
  }

  return {
    state: 'completed' as const,
    pendingTask: null,
    statusText,
  };
}

async function waitWithAbort(ms: number, signal: AbortSignal) {
  if (ms <= 0) return;

  await new Promise<void>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort);
  });
}

function buildNormalizedSingleResponse(responses: unknown[], responseItemsKey?: string) {
  return {
    mode: 'remote',
    itemCount: responses.length,
    items: responses,
    [responseItemsKey || 'items']: responses,
  } satisfies Record<string, unknown>;
}

function getPendingTaskLabel(task: PendingRenderTask | null) {
  if (!task) return '任务进入异步执行';
  if (task.taskId && task.status) return `异步任务 ${task.taskId}（${task.status}）仍在执行`;
  if (task.taskId) return `异步任务 ${task.taskId} 仍在执行`;
  return '异步任务仍在执行';
}

function stripVolatileSummary(summary: string[]) {
  return summary.filter((item) => !VOLATILE_SUMMARY_PREFIXES.some((prefix) => item.startsWith(prefix)));
}

async function settleAsyncResponse(input: {
  provider: ProviderKind;
  adapterConfig: ReturnType<typeof getProviderAdapterConfig>;
  headers: Record<string, string>;
  initialResponseBody: unknown;
  index: number;
  signal: AbortSignal;
  pendingHint?: PendingRenderTask | null;
}) {
  const initial = classifyAsyncResponse({
    adapterConfig: input.adapterConfig,
    responseBody: input.initialResponseBody,
    index: input.index,
    pendingHint: input.pendingHint,
  });

  if (initial.state === 'failed') {
    throw new Error(`${input.provider} provider task failed: ${initial.statusText || summarizeRemotePreview(input.initialResponseBody)}`);
  }

  if (initial.state === 'completed') {
    return {
      lifecycle: 'completed' as const,
      responseBody: input.initialResponseBody,
      preview: summarizeRemotePreview(input.initialResponseBody),
      pollAttempts: 0,
      pollPath: null,
      pendingTask: null,
      taskStatus: initial.statusText,
      trace: [],
    } satisfies ProviderAsyncResolution;
  }

  const pendingTask = initial.pendingTask;
  const pollRequest = buildProviderPollRequest({
    provider: input.provider,
    taskId: pendingTask?.taskId,
    headers: input.headers,
    overrideUrl: pendingTask?.pollUrl,
  });

  if (!pollRequest) {
    return {
      lifecycle: 'pending' as const,
      responseBody: input.initialResponseBody,
      preview: getPendingTaskLabel(pendingTask),
      pollAttempts: 0,
      pollPath: pendingTask?.pollUrl || null,
      pendingTask,
      taskStatus: initial.statusText,
      trace: [],
    } satisfies ProviderAsyncResolution;
  }

  let latestBody = input.initialResponseBody;
  let latestTask = pendingTask;
  let latestStatus = initial.statusText;
  const trace: ProviderAsyncTraceEntry[] = [];

  for (let attempt = 1; attempt <= input.adapterConfig.poll.maxAttempts; attempt += 1) {
    await waitWithAbort(input.adapterConfig.poll.intervalMs, input.signal);
    const response = await fetch(pollRequest.endpoint, {
      method: pollRequest.method,
      headers: pollRequest.requestHeaders,
      body: pollRequest.requestBody ? JSON.stringify(pollRequest.requestBody) : undefined,
      cache: 'no-store',
      signal: input.signal,
    });
    const rawText = await response.text();
    const parsed = safeJsonParse(rawText) || rawText;
    const classified = classifyAsyncResponse({
      adapterConfig: input.adapterConfig,
      responseBody: parsed,
      index: input.index,
      pendingHint: latestTask,
    });

    trace.push({
      attempt,
      endpoint: pollRequest.endpoint,
      status: response.status,
      preview: rawText.slice(0, 180),
      taskId: classified.pendingTask?.taskId || latestTask?.taskId,
      taskStatus: classified.statusText,
      checkedAt: new Date().toISOString(),
    });

    if (!response.ok) {
      throw new Error(`${input.provider} poll failed: ${response.status} ${rawText.slice(0, 240)}`);
    }

    latestBody = parsed;
    latestTask = classified.pendingTask || latestTask;
    latestStatus = classified.statusText;

    if (classified.state === 'failed') {
      throw new Error(`${input.provider} provider task failed: ${classified.statusText || rawText.slice(0, 160)}`);
    }

    if (classified.state === 'completed') {
      return {
        lifecycle: 'completed' as const,
        responseBody: latestBody,
        preview: summarizeRemotePreview(latestBody),
        pollAttempts: attempt,
        pollPath: pollRequest.endpoint,
        pendingTask: null,
        taskStatus: latestStatus,
        trace,
      } satisfies ProviderAsyncResolution;
    }
  }

  return {
    lifecycle: 'pending' as const,
    responseBody: latestBody,
    preview: getPendingTaskLabel(latestTask),
    pollAttempts: trace.length,
    pollPath: pollRequest.endpoint,
    pendingTask: latestTask,
    taskStatus: latestStatus,
    trace,
  } satisfies ProviderAsyncResolution;
}

async function getRenderProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      renderJobs: { orderBy: { createdAt: 'desc' } },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function getRenderProject(projectId?: string) {
  return projectId
    ? getRenderProjectById(projectId)
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          scenes: { orderBy: { orderIndex: 'asc' } },
          shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
          renderJobs: { orderBy: { createdAt: 'desc' } },
          references: { orderBy: { createdAt: 'desc' } },
          outlines: { orderBy: { createdAt: 'desc' } },
        },
      });
}

export async function exportRenderPresets(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const referenceProfile = buildReferenceProfile(project.references);
  const referenceBindings = buildReferenceBindingSnapshot(project);
  const presets = project.shots.map((shot) => {
    const binding = referenceBindings.effectiveShotMap.get(shot.id) || null;
    return getRenderPresetForShot(
      shot,
      visualBible,
      characters,
      binding ? { promptLine: binding.promptLine, titles: binding.referenceTitles, note: binding.note } : null,
    );
  });

  return {
    projectId: project.id,
    projectTitle: project.title,
    sceneTitles: project.scenes.map((scene) => scene.title),
    visualBible,
    characters,
    referenceProfile,
    referenceBindings: {
      sceneBindings: referenceBindings.sceneBindings.map((binding) => ({
        targetId: binding.targetId,
        targetLabel: binding.targetLabel,
        referenceTitles: binding.referenceTitles,
        note: binding.note,
        promptLine: binding.promptLine,
      })),
      shotBindings: referenceBindings.shotBindings.map((binding) => ({
        targetId: binding.targetId,
        targetLabel: binding.targetLabel,
        referenceTitles: binding.referenceTitles,
        note: binding.note,
        promptLine: binding.promptLine,
      })),
      effectiveShotBindingCount: referenceBindings.effectiveShotBindingCount,
    },
    presets,
  };
}

export async function exportProviderPayloads(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const characterSummary = summarizeCharacters(characters);
  const referenceProfile = buildReferenceProfile(project.references);
  const referenceInsights = getReferenceInsights(project.references);
  const referenceBindings = buildReferenceBindingSnapshot(project);
  const providerProfiles = getProviderProfileSnapshotMap();
  const timeline = await getTimelineBundle(projectId).catch(() => null);
  const timelineSceneMap = new Map((timeline?.scenes || []).map((scene) => [scene.id, scene]));
  const timelineShotMap = new Map((timeline?.scenes || []).flatMap((scene) => scene.shots.map((shot) => [shot.id, { ...shot, sceneId: scene.id, sceneTitle: scene.title }])));
  const sceneTitleMap = new Map(project.scenes.map((scene) => [scene.id, scene.title]));
  const presets = project.shots.map((shot) => {
    const binding = referenceBindings.effectiveShotMap.get(shot.id) || null;
    return {
      shot,
      binding,
      preset: getRenderPresetForShot(
        shot,
        visualBible,
        characters,
        binding ? { promptLine: binding.promptLine, titles: binding.referenceTitles, note: binding.note } : null,
      ),
    };
  });

  const imagePayload = presets.map(({ shot, preset, binding }) => {
    const timelineShot = timelineShotMap.get(shot.id);
    return {
      provider: 'image-sequence',
      providerName: providerProfiles.imageSequence.providerName,
      providerModel: providerProfiles.imageSequence.providerModel || null,
      providerEndpoint: providerProfiles.imageSequence.url || null,
      providerMode: providerProfiles.imageSequence.executionModeHint,
      providerTimeoutMs: providerProfiles.imageSequence.timeoutMs,
      shotId: shot.id,
      shotTitle: shot.title,
      sceneTitle: sceneTitleMap.get(shot.sceneId || '') || '未分场',
      prompt: shot.prompt,
      cameraNotes: shot.cameraNotes,
      visualStyle: preset.visualStyle,
      cameraMotion: preset.cameraMotion,
      pacing: preset.pacing,
      emphasis: preset.emphasis,
      palette: preset.palette,
      lighting: preset.lighting,
      textureKeywords: preset.textureKeywords,
      characterSummary,
      referenceTitles: referenceProfile.titles,
      referenceFraming: referenceProfile.framing,
      referenceEmotion: referenceProfile.emotion,
      referenceMovement: referenceProfile.movement,
      referenceNotes: referenceProfile.noteSummary,
      referenceHighlights: referenceProfile.highlights,
      referenceSourceUrls: referenceProfile.sourceUrls,
      referenceLocalPaths: referenceProfile.localPaths,
      boundReferenceTitles: binding?.referenceTitles || [],
      boundReferencePromptLine: binding?.promptLine || null,
      boundReferenceNote: binding?.note || '',
      boundReferenceSourceUrls: binding?.sourceUrls || [],
      boundReferenceLocalPaths: binding?.localPaths || [],
      plannedDuration: timelineShot?.duration || null,
      timelineStartAt: timelineShot?.startAt || null,
      timelineEndAt: timelineShot?.endAt || null,
      emotionScore: timelineShot?.emotion || null,
      emotionLabel: timelineShot?.emotionLabel || null,
      beatType: timelineShot?.beatType || null,
      beatNote: timelineShot?.note || '',
    };
  });

  const voicePayload = project.scenes.map((scene) => {
    const timelineScene = timelineSceneMap.get(scene.id);
    const sceneBinding = referenceBindings.sceneMap.get(scene.id) || null;
    return {
      provider: 'voice-synthesis',
      providerName: providerProfiles.voiceSynthesis.providerName,
      providerModel: providerProfiles.voiceSynthesis.providerModel || null,
      providerEndpoint: providerProfiles.voiceSynthesis.url || null,
      providerMode: providerProfiles.voiceSynthesis.executionModeHint,
      providerTimeoutMs: providerProfiles.voiceSynthesis.timeoutMs,
      sceneId: scene.id,
      sceneTitle: scene.title,
      summary: scene.summary,
      audioPlan: 'dialogue+ambience',
      styleName: visualBible?.styleName || null,
      characterSummary,
      referenceTitles: referenceProfile.titles,
      referenceEmotion: referenceProfile.emotion,
      referenceMovement: referenceProfile.movement,
      referenceNotes: referenceProfile.noteSummary,
      referenceSourceUrls: referenceProfile.sourceUrls,
      referenceLocalPaths: referenceProfile.localPaths,
      boundReferenceTitles: sceneBinding?.referenceTitles || [],
      boundReferencePromptLine: sceneBinding?.promptLine || null,
      boundReferenceNote: sceneBinding?.note || '',
      boundReferenceSourceUrls: sceneBinding?.sourceUrls || [],
      boundReferenceLocalPaths: sceneBinding?.localPaths || [],
      targetDuration: timelineScene?.duration || null,
      emotionScore: timelineScene?.emotionScore || null,
      emotionLabel: timelineScene?.emotionLabel || null,
      beatMarkers: timelineScene?.beatMarkers || [],
    };
  });

  const videoPayload = presets.map(({ shot, preset, binding }) => {
    const timelineShot = timelineShotMap.get(shot.id);
    const timelineScene = timelineSceneMap.get(shot.sceneId || '');
    return {
      provider: 'video-assembly',
      providerName: providerProfiles.videoAssembly.providerName,
      providerModel: providerProfiles.videoAssembly.providerModel || null,
      providerEndpoint: providerProfiles.videoAssembly.url || null,
      providerMode: providerProfiles.videoAssembly.executionModeHint,
      providerTimeoutMs: providerProfiles.videoAssembly.timeoutMs,
      shotId: shot.id,
      shotTitle: shot.title,
      sceneTitle: sceneTitleMap.get(shot.sceneId || '') || '未分场',
      visualStyle: preset.visualStyle,
      cameraMotion: preset.cameraMotion,
      pacing: preset.pacing,
      audioFocus: preset.audioFocus,
      referenceReady: hasReferenceFlavor(shot.prompt),
      lensLanguage: preset.lensLanguage,
      motionLanguage: preset.motionLanguage,
      styleName: preset.visualBibleStyle,
      characterSummary,
      referenceTitles: referenceProfile.titles,
      referenceFraming: referenceProfile.framing,
      referenceEmotion: referenceProfile.emotion,
      referenceMovement: referenceProfile.movement,
      referenceHighlights: referenceProfile.highlights,
      boundReferenceTitles: binding?.referenceTitles || [],
      boundReferencePromptLine: binding?.promptLine || null,
      boundReferenceNote: binding?.note || '',
      boundReferenceSourceUrls: binding?.sourceUrls || [],
      boundReferenceLocalPaths: binding?.localPaths || [],
      plannedDuration: timelineShot?.duration || null,
      timelineStartAt: timelineShot?.startAt || null,
      timelineEndAt: timelineShot?.endAt || null,
      emotionScore: timelineShot?.emotion || null,
      emotionLabel: timelineShot?.emotionLabel || null,
      beatType: timelineShot?.beatType || null,
      beatNote: timelineShot?.note || '',
      sceneDuration: timelineScene?.duration || null,
      sceneEmotionLabel: timelineScene?.emotionLabel || null,
      projectTotalDuration: timeline?.totalSeconds || null,
      projectTotalDurationLabel: timeline?.totalDurationLabel || null,
    };
  });

  return {
    projectId: project.id,
    projectTitle: project.title,
    visualBible,
    characters,
    referenceProfile,
    referenceInsights,
    referenceBindings: {
      sceneBindings: referenceBindings.sceneBindings.map((binding) => ({
        targetId: binding.targetId,
        targetLabel: binding.targetLabel,
        referenceTitles: binding.referenceTitles,
        note: binding.note,
        promptLine: binding.promptLine,
      })),
      shotBindings: referenceBindings.shotBindings.map((binding) => ({
        targetId: binding.targetId,
        targetLabel: binding.targetLabel,
        referenceTitles: binding.referenceTitles,
        note: binding.note,
        promptLine: binding.promptLine,
      })),
      effectiveShotBindingCount: referenceBindings.effectiveShotBindingCount,
    },
    timelineSummary: timeline
      ? {
          totalSeconds: timeline.totalSeconds,
          totalDurationLabel: timeline.totalDurationLabel,
          warningCount: timeline.warnings.length,
          sceneCount: timeline.scenes.length,
          shotCount: timeline.scenes.reduce((sum, scene) => sum + scene.shots.length, 0),
          beatMarkerCount: timeline.scenes.reduce((sum, scene) => sum + scene.shots.filter((shot) => Boolean(shot.beatType)).length, 0),
        }
      : null,
    providerProfiles,
    providers: {
      imageSequence: imagePayload,
      voiceSynthesis: voicePayload,
      videoAssembly: videoPayload,
    },
  };
}

export async function exportProductionBundle(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      renderJobs: { orderBy: { createdAt: 'desc' } },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');

  const presetsData = await exportRenderPresets(projectId);
  const providerData = await exportProviderPayloads(projectId);
  const finalCutPlan = await getFinalCutPlan(projectId).catch(() => null);
  const generatedMedia = getGeneratedMediaEntries(project);
  const referenceInsights = getReferenceInsights(project.references);
  const referenceBindings = buildReferenceBindingSnapshot(project);
  const bundle = {
    projectId: project.id,
    projectTitle: project.title,
    exportedAt: new Date().toISOString(),
    visualBible: presetsData.visualBible,
    characters: presetsData.characters,
    referenceProfile: providerData.referenceProfile,
    referenceInsights,
    referenceBindings: {
      sceneBindings: referenceBindings.sceneBindings.map((binding) => ({
        targetId: binding.targetId,
        targetLabel: binding.targetLabel,
        referenceTitles: binding.referenceTitles,
        note: binding.note,
        promptLine: binding.promptLine,
      })),
      shotBindings: referenceBindings.shotBindings.map((binding) => ({
        targetId: binding.targetId,
        targetLabel: binding.targetLabel,
        referenceTitles: binding.referenceTitles,
        note: binding.note,
        promptLine: binding.promptLine,
      })),
      effectiveShotBindingCount: referenceBindings.effectiveShotBindingCount,
    },
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      summary: scene.summary,
      orderIndex: scene.orderIndex,
    })),
    shots: project.shots.map((shot) => ({
      id: shot.id,
      title: shot.title,
      prompt: shot.prompt,
      cameraNotes: shot.cameraNotes,
      orderIndex: shot.orderIndex,
      sceneId: shot.sceneId,
    })),
    renderJobs: project.renderJobs.map((job) => ({
      id: job.id,
      provider: job.provider,
      status: job.status,
      output: parseRenderJobOutput(job.outputUrl),
    })),
    generatedMedia,
    finalCut: finalCutPlan,
    presets: presetsData.presets,
    providerProfiles: providerData.providerProfiles,
    providerPayloads: providerData.providers,
  };

  const baseDir = path.join(process.cwd(), 'exports');
  const bundleName = `${timestampTag()}-${slugifyProjectTitle(project.title)}`;
  const bundleDir = path.join(baseDir, bundleName);
  await mkdir(bundleDir, { recursive: true });

  const presetsPath = path.join(bundleDir, 'render-presets.json');
  const providersPath = path.join(bundleDir, 'provider-payloads.json');
  const generatedMediaPath = path.join(bundleDir, 'generated-media-library.json');
  const finalCutPath = path.join(bundleDir, 'final-cut-plan.json');
  const bundlePath = path.join(bundleDir, 'production-bundle.json');
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const zipPath = path.join(baseDir, `${bundleName}.zip`);

  await writeFile(presetsPath, JSON.stringify(presetsData, null, 2), 'utf8');
  await writeFile(providersPath, JSON.stringify(providerData, null, 2), 'utf8');
  await writeFile(generatedMediaPath, JSON.stringify({ version: 1, items: generatedMedia }, null, 2), 'utf8');
  await writeFile(finalCutPath, JSON.stringify({ version: 1, exportedAt: bundle.exportedAt, plan: finalCutPlan }, null, 2), 'utf8');
  await writeFile(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');

  const manifest = {
    projectId: project.id,
    projectTitle: project.title,
    exportedAt: bundle.exportedAt,
    bundleDir,
    visualBibleStyle: presetsData.visualBible?.styleName || null,
    characterSummary: summarizeCharacters(presetsData.characters),
    providerProfiles: providerData.providerProfiles,
    files: [
      'render-presets.json',
      'provider-payloads.json',
      'generated-media-library.json',
      'final-cut-plan.json',
      'production-bundle.json',
    ],
    usage: [
      '先看 production-bundle.json 获取全量总览',
      'provider-payloads.json 直接用于对接 image / voice / video provider',
      'generated-media-library.json 可查看本次沉淀出的媒体资产索引',
      'final-cut-plan.json 可直接用于成片预演、镜头拼装顺序与缺口复核',
      'render-presets.json 用于单镜头渲染预设调试与复核',
    ],
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  await execFileAsync('zip', ['-r', zipPath, bundleName], { cwd: baseDir });

  return {
    bundleDir,
    zipPath,
    files: {
      manifestPath,
      presetsPath,
      providersPath,
      generatedMediaPath,
      finalCutPath,
      bundlePath,
    },
  };
}

function createJobSeedMeta(input: {
  payloadCount: number;
  summary: string[];
  providerName?: string;
  providerModel?: string;
}) {
  return serializeRenderJobOutput({
    mode: 'mock',
    payloadCount: input.payloadCount,
    retryCount: 0,
    summary: input.summary,
    providerName: input.providerName,
    providerModel: input.providerModel,
  });
}

export async function createRenderJobsForLatestProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      scenes: { orderBy: { orderIndex: 'asc' } },
      shots: { orderBy: [{ sceneId: 'asc' }, { orderIndex: 'asc' }] },
      references: { orderBy: { createdAt: 'desc' } },
      outlines: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) throw new Error('项目不存在');
  if (project.shots.length === 0) throw new Error('没有可用于渲染的 shot');

  const payloads = await exportProviderPayloads(projectId);
  const providerProfiles = payloads.providerProfiles;
  const visualBible = getVisualBible(project);
  const characters = getCharacterDrafts(project);
  const characterSummary = summarizeCharacters(characters);
  const shotKindsSummary = summarizeShotKinds(project.shots.map((shot) => shot.title));
  const referenceProfile = buildReferenceProfile(project.references);
  const referenceBindings = buildReferenceBindingSnapshot(project);
  const referenceReadyShots = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyScenes = project.scenes.filter((scene) => (scene.summary || '').includes('导演处理上强调')).length;
  const presetPreview = project.shots.slice(0, 3).map((shot) => {
    const binding = referenceBindings.effectiveShotMap.get(shot.id) || null;
    const preset = getRenderPresetForShot(shot, visualBible, characters, binding ? { promptLine: binding.promptLine, titles: binding.referenceTitles, note: binding.note } : null);
    return `${preset.kind}:${preset.visualStyle}`;
  }).join(';');

  await prisma.renderJob.deleteMany({ where: { projectId } });

  await prisma.renderJob.createMany({
    data: [
      {
        projectId,
        status: 'queued',
        provider: 'image-sequence',
        outputUrl: createJobSeedMeta({
          payloadCount: payloads.providers.imageSequence.length,
          providerName: providerProfiles.imageSequence.providerName,
          providerModel: providerProfiles.imageSequence.providerModel,
          summary: [`shots:${project.shots.length}`, `kinds:${shotKindsSummary}`, `style:${visualBible?.styleName || 'none'}`, `references:${referenceProfile.total}`, `boundShots:${referenceBindings.effectiveShotBindingCount}`, `characters:${characterSummary}`, `presetPreview:${presetPreview}`],
        }),
      },
      {
        projectId,
        status: 'queued',
        provider: 'voice-synthesis',
        outputUrl: createJobSeedMeta({
          payloadCount: payloads.providers.voiceSynthesis.length,
          providerName: providerProfiles.voiceSynthesis.providerName,
          providerModel: providerProfiles.voiceSynthesis.providerModel,
          summary: [`scenes:${project.scenes.length}`, `directorReady:${directorReadyScenes}`, `style:${visualBible?.styleName || 'none'}`, `references:${referenceProfile.total}`, `characters:${characterSummary}`, 'audioPlan:dialogue+ambience'],
        }),
      },
      {
        projectId,
        status: 'queued',
        provider: 'video-assembly',
        outputUrl: createJobSeedMeta({
          payloadCount: payloads.providers.videoAssembly.length,
          providerName: providerProfiles.videoAssembly.providerName,
          providerModel: providerProfiles.videoAssembly.providerModel,
          summary: [`referenceReady:${referenceReadyShots}`, `references:${referenceProfile.total}`, `boundShots:${referenceBindings.effectiveShotBindingCount}`, `style:${visualBible?.styleName || 'none'}`, `characters:${characterSummary}`, 'presetLinked:true'],
        }),
      },
    ],
  });

  return getRenderProjectById(projectId);
}

function getProviderPayloadByKind(providerPayloads: Awaited<ReturnType<typeof exportProviderPayloads>>['providers'], provider: ProviderKind) {
  if (provider === 'image-sequence') return providerPayloads.imageSequence;
  if (provider === 'voice-synthesis') return providerPayloads.voiceSynthesis;
  return providerPayloads.videoAssembly;
}

async function writeExecutionArtifacts(projectTitle: string, provider: ProviderKind, payload: unknown) {
  const runDir = path.join(process.cwd(), 'exports', 'render-runs', `${timestampTag()}-${slugifyProjectTitle(projectTitle)}`);
  await mkdir(runDir, { recursive: true });
  const requestPath = path.join(runDir, `${provider}-request.json`);
  await writeFile(requestPath, JSON.stringify(payload, null, 2), 'utf8');
  return { runDir, requestPath };
}

async function executeProvider(provider: ProviderKind, project: { id: string; title: string }, payload: unknown[]) {
  const providerProfile = getProviderProfileSnapshot(provider);
  const adapterConfig = getProviderAdapterConfig(provider);
  const endpoint = getProviderEndpoint(provider);
  const timeoutMs = getProviderTimeoutMs(provider);
  const { runDir, requestPath } = await writeExecutionArtifacts(project.title, provider, payload);
  const responsePath = path.join(runDir, `${provider}-response.json`);
  const pollTracePath = path.join(runDir, `${provider}-poll-trace.json`);

  if (!endpoint) {
    const mockResponse = {
      mode: 'mock',
      provider,
      projectId: project.id,
      generatedAt: new Date().toISOString(),
      itemCount: payload.length,
      providerName: providerProfile.providerName,
      providerModel: providerProfile.providerModel || null,
      adapter: adapterConfig.mode,
      message: '未配置真实 provider endpoint，已生成 mock 执行结果，可继续走 QA / 导出闭环。',
    };
    await writeFile(responsePath, JSON.stringify(mockResponse, null, 2), 'utf8');
    return {
      mode: 'mock' as const,
      lifecycle: 'completed' as const,
      endpoint: null,
      timeoutMs,
      runDir,
      requestPath,
      responsePath,
      responseBody: mockResponse,
      preview: mockResponse.message,
      summary: [`mode:mock`, `adapter:${adapterConfig.mode}`, `items:${payload.length}`, `timeout:${timeoutMs}ms`, `response:${path.basename(responsePath)}`],
      pollAttempts: 0,
      pollPath: null,
      pollTracePath: null,
      taskStatus: null,
      pendingTasks: [] as PendingRenderTask[],
    };
  }

  const requestPlan = buildProviderAdapterRequest({
    provider,
    project,
    payload,
    headers: buildProviderHeaders(provider),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`timeout:${timeoutMs}`), timeoutMs);

  try {
    const baseSummary = [`mode:remote`, `adapter:${adapterConfig.mode}`, `items:${payload.length}`, `timeout:${timeoutMs}ms`, `endpoint:${requestPlan.endpoint}`, `response:${path.basename(responsePath)}`];
    const traceEntries: ProviderAsyncTraceEntry[] = [];

    if (requestPlan.batchMode === 'batch') {
      const response = await fetch(requestPlan.endpoint, {
        method: 'POST',
        headers: requestPlan.requestHeaders,
        body: JSON.stringify(requestPlan.requestBody),
        cache: 'no-store',
        signal: controller.signal,
      });
      const rawText = await response.text();
      const responseBody = safeJsonParse(rawText) || rawText;
      if (!response.ok) {
        throw new Error(`${provider} provider failed: ${response.status} ${rawText.slice(0, 240)}`);
      }

      const settled = await settleAsyncResponse({
        provider,
        adapterConfig,
        headers: requestPlan.requestHeaders,
        initialResponseBody: responseBody,
        index: 0,
        signal: controller.signal,
      });
      traceEntries.push(...settled.trace);
      await writeFile(responsePath, typeof settled.responseBody === 'string' ? settled.responseBody : JSON.stringify(settled.responseBody, null, 2), 'utf8');
      if (traceEntries.length > 0) {
        await writeFile(pollTracePath, JSON.stringify({ provider, generatedAt: new Date().toISOString(), items: traceEntries }, null, 2), 'utf8');
      }

      if (settled.lifecycle === 'pending') {
        return {
          mode: 'remote' as const,
          lifecycle: 'pending' as const,
          endpoint: requestPlan.endpoint,
          timeoutMs,
          runDir,
          requestPath,
          responsePath,
          responseBody: settled.responseBody,
          preview: settled.preview,
          summary: [...baseSummary, `pollAttempts:${settled.pollAttempts}`, 'pendingTasks:1'],
          pollAttempts: settled.pollAttempts,
          pollPath: settled.pollPath,
          pollTracePath: traceEntries.length > 0 ? pollTracePath : null,
          taskStatus: settled.taskStatus,
          pendingTasks: settled.pendingTask ? [settled.pendingTask] : [],
        };
      }

      const completedSummary = settled.pollAttempts > 0
        ? [...baseSummary, `pollAttempts:${settled.pollAttempts}`]
        : baseSummary;

      return {
        mode: 'remote' as const,
        lifecycle: 'completed' as const,
        endpoint: requestPlan.endpoint,
        timeoutMs,
        runDir,
        requestPath,
        responsePath,
        responseBody: settled.responseBody,
        preview: settled.preview,
        summary: completedSummary,
        pollAttempts: settled.pollAttempts,
        pollPath: settled.pollPath,
        pollTracePath: traceEntries.length > 0 ? pollTracePath : null,
        taskStatus: settled.taskStatus,
        pendingTasks: [] as PendingRenderTask[],
      };
    }

    const requestBodies = Array.isArray(requestPlan.requestBody) ? requestPlan.requestBody : [requestPlan.requestBody];
    const responseBodies: unknown[] = [];
    const pendingTasks: PendingRenderTask[] = [];
    let totalPollAttempts = 0;
    let pollPath: string | null = null;
    let taskStatus: string | null = null;

    for (const [index, requestBody] of requestBodies.entries()) {
      const response = await fetch(requestPlan.endpoint, {
        method: 'POST',
        headers: requestPlan.requestHeaders,
        body: JSON.stringify(requestBody),
        cache: 'no-store',
        signal: controller.signal,
      });
      const rawText = await response.text();
      const responseBody = safeJsonParse(rawText) || rawText;
      if (!response.ok) {
        throw new Error(`${provider} provider failed: ${response.status} ${rawText.slice(0, 240)}`);
      }

      const settled = await settleAsyncResponse({
        provider,
        adapterConfig,
        headers: requestPlan.requestHeaders,
        initialResponseBody: responseBody,
        index,
        signal: controller.signal,
      });

      responseBodies[index] = settled.responseBody;
      totalPollAttempts += settled.pollAttempts;
      taskStatus = settled.taskStatus || taskStatus;
      pollPath = settled.pollPath || pollPath;
      traceEntries.push(...settled.trace);
      if (settled.pendingTask) pendingTasks.push(settled.pendingTask);
    }

    const normalizedResponse = normalizeAdapterResponse(responseBodies, requestPlan);
    await writeFile(responsePath, JSON.stringify(normalizedResponse, null, 2), 'utf8');
    if (traceEntries.length > 0) {
      await writeFile(pollTracePath, JSON.stringify({ provider, generatedAt: new Date().toISOString(), items: traceEntries }, null, 2), 'utf8');
    }

    if (pendingTasks.length > 0) {
      return {
        mode: 'remote' as const,
        lifecycle: 'pending' as const,
        endpoint: requestPlan.endpoint,
        timeoutMs,
        runDir,
        requestPath,
        responsePath,
        responseBody: normalizedResponse,
        preview: `已有 ${pendingTasks.length} 个异步任务进入回查阶段`,
        summary: [...baseSummary, `pollAttempts:${totalPollAttempts}`, `pendingTasks:${pendingTasks.length}`],
        pollAttempts: totalPollAttempts,
        pollPath,
        pollTracePath: traceEntries.length > 0 ? pollTracePath : null,
        taskStatus,
        pendingTasks,
      };
    }

    const completedSummary = totalPollAttempts > 0
      ? [...baseSummary, `pollAttempts:${totalPollAttempts}`]
      : baseSummary;

    return {
      mode: 'remote' as const,
      lifecycle: 'completed' as const,
      endpoint: requestPlan.endpoint,
      timeoutMs,
      runDir,
      requestPath,
      responsePath,
      responseBody: normalizedResponse,
      preview: JSON.stringify(normalizedResponse).slice(0, 180),
      summary: completedSummary,
      pollAttempts: totalPollAttempts,
      pollPath,
      pollTracePath: traceEntries.length > 0 ? pollTracePath : null,
      taskStatus,
      pendingTasks: [] as PendingRenderTask[],
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${provider} provider timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}


type RenderPayloadRecord = Record<string, unknown>;
type ProviderResponseRecord = Record<string, unknown>;

const PROVIDER_RESPONSE_COLLECTION_KEYS: Record<ProviderKind, string[]> = {
  'image-sequence': ['images', 'image', 'frames', 'items', 'outputs', 'results', 'assets', 'files', 'data', 'output', 'result', 'artifact', 'artifacts', 'file', 'media'],
  'voice-synthesis': ['audios', 'audio', 'items', 'outputs', 'results', 'assets', 'files', 'data', 'output', 'result', 'artifact', 'artifacts', 'file', 'media'],
  'video-assembly': ['videos', 'video', 'clips', 'items', 'outputs', 'results', 'assets', 'files', 'data', 'output', 'result', 'artifact', 'artifacts', 'file', 'media'],
};

const RESPONSE_WRAPPER_KEYS = Array.from(new Set([
  'data',
  'output',
  'outputs',
  'result',
  'results',
  'response',
  'body',
  'payload',
  'artifact',
  'artifacts',
  'file',
  'files',
  'media',
  'items',
  'assets',
  'images',
  'image',
  'videos',
  'video',
  'audios',
  'audio',
  'clips',
  'frames',
]));

const RESPONSE_SUMMARY_KEYS = ['summary', 'message', 'description', 'caption', 'text', 'detail', 'statusText'];
const RESPONSE_SOURCE_URL_KEYS = ['url', 'outputUrl', 'sourceUrl', 'imageUrl', 'videoUrl', 'audioUrl', 'downloadUrl', 'uri', 'src', 'href'];
const RESPONSE_INLINE_DATA_KEYS = ['inlineData', 'inline_data'];
const RESPONSE_LOCAL_PATH_KEYS = ['localPath', 'path', 'filePath', 'outputPath', 'destination', 'savePath', 'targetPath'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeUrl(value: string) {
  const normalized = value.trim();
  return /^(https?:\/\/|data:|blob:|\/\/)/i.test(normalized);
}

function looksLikeLocalPath(value: string) {
  const normalized = value.trim();
  return /^([A-Za-z]:[\/]|\/|\.{1,2}[\/])/.test(normalized)
    || /\\/.test(normalized)
    || /\.(png|jpe?g|webp|gif|bmp|svg|mp4|mov|webm|mkv|mp3|wav|m4a|flac|aac|ogg|json)$/i.test(normalized);
}

function toRecord(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as ProviderResponseRecord;
  if (isNonEmptyString(value)) {
    const normalized = value.trim();
    if (looksLikeUrl(normalized)) return { value: normalized, url: normalized } satisfies ProviderResponseRecord;
    if (looksLikeLocalPath(normalized)) return { value: normalized, path: normalized } satisfies ProviderResponseRecord;
    return { value: normalized } satisfies ProviderResponseRecord;
  }
  return {} as ProviderResponseRecord;
}

function pickText(record: ProviderResponseRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (isNonEmptyString(value)) return value.trim();
  }
  return null;
}

function pickTextDeep(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 5 || value == null) return null;

  if (isNonEmptyString(value)) {
    return keys.includes('value') ? value.trim() : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = pickTextDeep(item, keys, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  const record = toRecord(value);
  const direct = pickText(record, keys);
  if (direct) return direct;

  for (const key of RESPONSE_WRAPPER_KEYS) {
    if (!(key in record)) continue;
    const nested = pickTextDeep(record[key], keys, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function resolveInlineDataDataUrl(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = resolveInlineDataDataUrl(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }
  const record = toRecord(value);
  for (const key of RESPONSE_INLINE_DATA_KEYS) {
    const node = toRecord(record[key]);
    const mimeType = typeof node.mime_type === 'string' ? node.mime_type : typeof node.mimeType === 'string' ? node.mimeType : '';
    const data = typeof node.data === 'string' ? node.data.trim() : '';
    if (data) return `data:${mimeType || 'application/octet-stream'};base64,${data}`;
  }
  for (const key of RESPONSE_WRAPPER_KEYS.concat(['candidates', 'content', 'parts'])) {
    if (!(key in record)) continue;
    const nested = resolveInlineDataDataUrl(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function resolveSourceUrl(record: ProviderResponseRecord) {
  const direct = pickTextDeep(record, RESPONSE_SOURCE_URL_KEYS);
  if (direct) return direct;
  const inlineDataUrl = resolveInlineDataDataUrl(record);
  if (inlineDataUrl) return inlineDataUrl;
  const fallback = pickTextDeep(record, ['value']);
  return fallback && looksLikeUrl(fallback) ? fallback : null;
}

function resolveLocalPath(record: ProviderResponseRecord) {
  const direct = pickTextDeep(record, RESPONSE_LOCAL_PATH_KEYS);
  if (direct && !looksLikeUrl(direct)) return direct;
  const fallback = pickTextDeep(record, ['value']);
  return fallback && looksLikeLocalPath(fallback) && !looksLikeUrl(fallback) ? fallback : null;
}

function collectResponseRecords(
  value: unknown,
  collectionKeys: string[],
  depth = 0,
  seen = new Set<string>(),
): ProviderResponseRecord[] {
  if (depth > 5 || value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectResponseRecords(item, collectionKeys, depth + 1, seen));
  }

  if (isNonEmptyString(value)) {
    const normalized = toRecord(value);
    if (Object.keys(normalized).length === 0) return [];
    const signature = JSON.stringify(normalized);
    if (seen.has(signature)) return [];
    seen.add(signature);
    return [normalized];
  }

  const record = toRecord(value);
  for (const key of collectionKeys) {
    if (!(key in record)) continue;
    const nested = collectResponseRecords(record[key], collectionKeys, depth + 1, seen);
    if (nested.length > 0) return nested;
  }

  const hasSummary = Boolean(pickTextDeep(record, RESPONSE_SUMMARY_KEYS));
  const sourceUrl = resolveSourceUrl(record);
  const localPath = resolveLocalPath(record);
  const fallbackValue = pickText(record, ['value']);
  const shouldKeep = hasSummary || Boolean(sourceUrl) || Boolean(localPath) || Boolean(fallbackValue) || (depth === 0 && Object.keys(record).length > 0);
  if (!shouldKeep) return [];

  const signature = JSON.stringify({
    summary: hasSummary ? pickTextDeep(record, RESPONSE_SUMMARY_KEYS) : null,
    sourceUrl,
    localPath,
    fallbackValue,
  });
  if (seen.has(signature)) return [];
  seen.add(signature);
  return [record];
}

function getResponseItems(responseBody: unknown, provider: ProviderKind) {
  if (Array.isArray(responseBody)) {
    return responseBody
      .map((item) => toRecord(item))
      .filter((item) => Object.keys(item).length > 0);
  }

  const items = collectResponseRecords(responseBody, PROVIDER_RESPONSE_COLLECTION_KEYS[provider]);
  if (items.length > 0) return items;

  const fallback = toRecord(responseBody);
  return Object.keys(fallback).length > 0 ? [fallback] : [];
}

function getGeneratedMediaType(provider: ProviderKind): GeneratedMediaType {
  if (provider === 'voice-synthesis') return 'generated-audio';
  if (provider === 'video-assembly') return 'generated-video';
  return 'generated-image';
}

function getGeneratedMediaTitle(provider: ProviderKind, payloadRecord: RenderPayloadRecord, index: number) {
  const shotTitle = typeof payloadRecord.shotTitle === 'string' ? payloadRecord.shotTitle : null;
  const sceneTitle = typeof payloadRecord.sceneTitle === 'string' ? payloadRecord.sceneTitle : null;

  if (provider === 'voice-synthesis') return `${sceneTitle || `Scene ${index + 1}`} 配音轨`;
  if (provider === 'video-assembly') return `${shotTitle || `Shot ${index + 1}`} 视频片段`;
  return `${shotTitle || `Shot ${index + 1}`} 图片结果`;
}

function getGeneratedMediaSummary(provider: ProviderKind, payloadRecord: RenderPayloadRecord, responseRecord: ProviderResponseRecord, mode: RenderExecutionMode) {
  const sceneTitle = typeof payloadRecord.sceneTitle === 'string' ? payloadRecord.sceneTitle : '未分场';
  const shotTitle = typeof payloadRecord.shotTitle === 'string' ? payloadRecord.shotTitle : '未命名镜头';
  const directSummary = pickTextDeep(responseRecord, RESPONSE_SUMMARY_KEYS);
  if (directSummary) return directSummary;
  if (provider === 'voice-synthesis') return `${sceneTitle} 的语音结果已生成并写入媒体索引（${mode === 'remote' ? '真实' : '模拟'}模式）。`;
  if (provider === 'video-assembly') return `${sceneTitle} / ${shotTitle} 的视频片段已生成并写入媒体索引（${mode === 'remote' ? '真实' : '模拟'}模式）。`;
  return `${sceneTitle} / ${shotTitle} 的图片结果已生成并写入媒体索引（${mode === 'remote' ? '真实' : '模拟'}模式）。`;
}

function getGeneratedMediaTags(provider: ProviderKind, payloadRecord: RenderPayloadRecord, mode: RenderExecutionMode) {
  const tags: string[] = [provider, mode];
  const sceneTitle = typeof payloadRecord.sceneTitle === 'string' ? payloadRecord.sceneTitle : null;
  const shotTitle = typeof payloadRecord.shotTitle === 'string' ? payloadRecord.shotTitle : null;
  if (sceneTitle) tags.push(sceneTitle);
  if (shotTitle) tags.push(shotTitle);
  return tags;
}

async function syncGeneratedMediaArtifacts(input: {
  projectId: string;
  provider: ProviderKind;
  jobId: string;
  payload: unknown[];
  runDir: string;
  requestPath: string;
  responsePath: string;
  responseBody: unknown;
  mode: RenderExecutionMode;
}) {
  const outputDir = path.join(input.runDir, 'generated-media');
  await mkdir(outputDir, { recursive: true });

  const responseItems = getResponseItems(input.responseBody, input.provider);
  const fallbackResponseRecord = responseItems.length === 1 ? responseItems[0] : toRecord(input.responseBody);
  const createdAt = new Date().toISOString();
  const entries: GeneratedMediaEntry[] = [];
  const reuseSinglePayload = input.payload.length === 1 && responseItems.length > 1;
  const loopCount = reuseSinglePayload ? responseItems.length : input.payload.length;

  for (let index = 0; index < loopCount; index += 1) {
    const payloadItem = input.payload[reuseSinglePayload ? 0 : index] ?? input.payload[0] ?? {};
    const payloadRecord = toRecord(payloadItem) as RenderPayloadRecord;
    const responseRecord = responseItems[index] || fallbackResponseRecord;
    const baseTitle = getGeneratedMediaTitle(input.provider, payloadRecord, reuseSinglePayload ? 0 : index);
    const title = reuseSinglePayload && index > 0 ? `${baseTitle}（变体 ${index + 1}）` : baseTitle;
    const artifactName = `${String(index + 1).padStart(2, '0')}-${slugifyProjectTitle(title)}.json`;
    const artifactPath = path.join(outputDir, artifactName);
    await writeFile(artifactPath, JSON.stringify({
      provider: input.provider,
      mode: input.mode,
      generatedAt: createdAt,
      payload: payloadRecord,
      response: responseRecord,
      requestPath: input.requestPath,
      responsePath: input.responsePath,
    }, null, 2), 'utf8');

    const shotId = typeof payloadRecord.shotId === 'string' ? payloadRecord.shotId : undefined;
    const sceneId = typeof payloadRecord.sceneId === 'string' ? payloadRecord.sceneId : undefined;
    const sourceUrl = resolveSourceUrl(responseRecord);
    const localPath = resolveLocalPath(responseRecord) || artifactPath;

    entries.push({
      id: `media-${input.provider}-${shotId || sceneId || 'item'}-${index + 1}`,
      provider: input.provider,
      type: getGeneratedMediaType(input.provider),
      title,
      summary: getGeneratedMediaSummary(input.provider, payloadRecord, responseRecord, input.mode),
      tags: getGeneratedMediaTags(input.provider, payloadRecord, input.mode),
      sceneId,
      shotId,
      sourceUrl,
      localPath,
      artifactPath,
      requestPath: input.requestPath,
      responsePath: input.responsePath,
      mode: input.mode,
      createdAt,
    });
  }

  const indexPath = path.join(outputDir, `${input.provider}-media-index.json`);
  await writeFile(indexPath, JSON.stringify({ version: 1, provider: input.provider, generatedAt: createdAt, items: entries }, null, 2), 'utf8');
  await replaceGeneratedMediaEntriesForProvider(input.projectId, input.provider, entries);

  return { entries, indexPath };
}


function buildRenderJobLabel(input?: RenderJobQuery, failedOnly = false) {
  if (input?.jobId) return failedOnly ? '当前没有可重试的指定任务' : '当前没有可执行的指定任务';
  if (input?.provider) {
    const label = input.provider === 'image-sequence' ? '图像任务' : input.provider === 'voice-synthesis' ? '语音任务' : '视频任务';
    return failedOnly ? `当前没有失败的${label}可重试` : `当前没有可执行的${label}`;
  }
  return failedOnly ? '当前没有失败任务可重试' : '当前没有可执行的渲染任务';
}

function buildAdvanceJobLabel(input?: RenderJobQuery) {
  if (input?.jobId) return '当前指定任务没有待推进的异步执行';
  if (input?.provider) {
    const label = input.provider === 'image-sequence' ? '图像任务' : input.provider === 'voice-synthesis' ? '语音任务' : '视频任务';
    return `当前没有执行中的${label}可推进`;
  }
  return '当前没有执行中的异步任务可推进';
}

async function findRenderJobs(projectId: string, statuses: string[], query?: RenderJobQuery) {
  const where: Record<string, unknown> = {
    projectId,
    status: { in: statuses },
  };

  if (query?.provider) where.provider = query.provider;
  if (query?.jobId) where.id = query.jobId;

  return prisma.renderJob.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

async function continueRunningRenderJob(input: {
  projectId: string;
  project: Awaited<ReturnType<typeof getRenderProjectById>>;
  jobId: string;
  provider: ProviderKind;
  providerProfile: ReturnType<typeof getProviderProfileSnapshot>;
  adapterConfig: ReturnType<typeof getProviderAdapterConfig>;
  existingMeta: RenderJobMeta;
  payload: unknown[];
}) {
  const requestPath = input.existingMeta.requestPath;
  const responsePath = input.existingMeta.responsePath;
  if (!requestPath || !responsePath) {
    throw new Error('当前任务缺少请求 / 响应工件，无法继续推进异步任务');
  }

  const pendingTasks = Array.isArray(input.existingMeta.pendingTasks) ? input.existingMeta.pendingTasks : [];
  if (pendingTasks.length === 0) {
    throw new Error('当前运行任务没有待推进的异步子任务');
  }

  const previousText = await readFile(responsePath, 'utf8').catch(() => '');
  const previousJson = safeJsonParse(previousText);
  const previousRecord = toLooseRecord(previousJson);
  const previousItems = Array.isArray(previousJson)
    ? [...previousJson]
    : Array.isArray(previousRecord.items)
      ? [...previousRecord.items]
      : Array.isArray(previousRecord[input.adapterConfig.responseItemsKey])
        ? [...(previousRecord[input.adapterConfig.responseItemsKey] as unknown[])]
        : input.payload.map(() => previousJson ?? {});

  while (previousItems.length < input.payload.length) previousItems.push({});

  const headers = buildProviderHeaders(input.provider);
  const timeoutMs = getProviderTimeoutMs(input.provider);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`timeout:${timeoutMs}`), timeoutMs);
  const pollTracePath = path.join(path.dirname(requestPath), `${input.provider}-poll-trace.json`);

  try {
    const traceEntries: ProviderAsyncTraceEntry[] = [];
    const remainingPending: PendingRenderTask[] = [];
    let totalPollAttempts = 0;
    let pollPath: string | null = input.existingMeta.pollPath || null;
    let taskStatus: string | null = input.existingMeta.taskStatus || null;

    for (const pendingTask of pendingTasks) {
      const settled = await settleAsyncResponse({
        provider: input.provider,
        adapterConfig: input.adapterConfig,
        headers,
        initialResponseBody: previousItems[pendingTask.index] ?? {},
        index: pendingTask.index,
        signal: controller.signal,
        pendingHint: pendingTask,
      });
      previousItems[pendingTask.index] = settled.responseBody;
      totalPollAttempts += settled.pollAttempts;
      pollPath = settled.pollPath || pollPath;
      taskStatus = settled.taskStatus || taskStatus;
      traceEntries.push(...settled.trace);
      if (settled.pendingTask) remainingPending.push(settled.pendingTask);
    }

    const normalizedResponse = buildNormalizedSingleResponse(previousItems, input.adapterConfig.responseItemsKey);
    await writeFile(responsePath, JSON.stringify(normalizedResponse, null, 2), 'utf8');
    if (traceEntries.length > 0) {
      await writeFile(pollTracePath, JSON.stringify({ provider: input.provider, generatedAt: new Date().toISOString(), items: traceEntries }, null, 2), 'utf8');
    }

    if (remainingPending.length > 0) {
      const summary = [
        ...stripVolatileSummary(input.existingMeta.summary),
        'status:pending',
        `pendingTasks:${remainingPending.length}`,
        `pollAttempts:${(input.existingMeta.pollAttempts || 0) + totalPollAttempts}`,
      ];
      if (pollPath) summary.push(`pollPath:${pollPath}`);
      if (taskStatus) summary.push(`lastTaskStatus:${taskStatus}`);

      await prisma.renderJob.update({
        where: { id: input.jobId },
        data: {
          status: 'running',
          outputUrl: serializeRenderJobOutput({
            ...input.existingMeta,
            mode: 'remote',
            requestPath,
            responsePath,
            preview: `仍有 ${remainingPending.length} 个异步任务在执行`,
            executedAt: new Date().toISOString(),
            lastError: undefined,
            timeoutMs,
            providerName: input.providerProfile.providerName,
            providerModel: input.providerProfile.providerModel || undefined,
            adapter: input.adapterConfig.mode,
            pollPath: pollPath || undefined,
            pollTracePath: traceEntries.length > 0 ? pollTracePath : input.existingMeta.pollTracePath,
            pollAttempts: (input.existingMeta.pollAttempts || 0) + totalPollAttempts,
            taskStatus: taskStatus || undefined,
            pendingTasks: remainingPending,
            summary,
          }),
        },
      });

      return;
    }

    const mediaArtifacts = await syncGeneratedMediaArtifacts({
      projectId: input.projectId,
      provider: input.provider,
      jobId: input.jobId,
      payload: input.payload,
      runDir: path.dirname(requestPath),
      requestPath,
      responsePath,
      responseBody: normalizedResponse,
      mode: 'remote',
    });
    const summary = input.provider === 'video-assembly'
      ? [...stripVolatileSummary(input.existingMeta.summary), 'final-cut:preview-ready']
      : input.provider === 'voice-synthesis'
        ? [...stripVolatileSummary(input.existingMeta.summary), 'voice-track:generated']
        : [...stripVolatileSummary(input.existingMeta.summary), 'frames:generated'];
    summary.push(`assets:${mediaArtifacts.entries.length}`);
    if ((input.existingMeta.pollAttempts || 0) + totalPollAttempts > 0) {
      summary.push(`pollAttempts:${(input.existingMeta.pollAttempts || 0) + totalPollAttempts}`);
    }
    if (pollPath) summary.push(`pollPath:${pollPath}`);
    if (taskStatus) summary.push(`lastTaskStatus:${taskStatus}`);

    await prisma.renderJob.update({
      where: { id: input.jobId },
      data: {
        status: 'done',
        outputUrl: serializeRenderJobOutput({
          ...input.existingMeta,
          mode: 'remote',
          requestPath,
          responsePath,
          preview: summarizeRemotePreview(normalizedResponse),
          executedAt: new Date().toISOString(),
          lastError: undefined,
          assetCount: mediaArtifacts.entries.length,
          artifactIndexPath: mediaArtifacts.indexPath,
          timeoutMs,
          providerName: input.providerProfile.providerName,
          providerModel: input.providerProfile.providerModel || undefined,
          adapter: input.adapterConfig.mode,
          pollPath: pollPath || undefined,
          pollTracePath: traceEntries.length > 0 ? pollTracePath : input.existingMeta.pollTracePath,
          pollAttempts: (input.existingMeta.pollAttempts || 0) + totalPollAttempts,
          taskStatus: taskStatus || undefined,
          pendingTasks: [],
          summary,
        }),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${input.provider} provider timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function executeRenderJob(projectId: string, jobId: string) {
  const project = await getRenderProjectById(projectId);
  if (!project) throw new Error('项目不存在');

  const job = project.renderJobs.find((item) => item.id === jobId);
  if (!job) throw new Error('渲染任务不存在');
  if (!job.provider) throw new Error('渲染任务缺少 provider');

  const provider = job.provider as ProviderKind;
  const providerProfile = getProviderProfileSnapshot(provider);
  const adapterConfig = getProviderAdapterConfig(provider);
  const existingMeta = parseRenderJobOutput(job.outputUrl);
  const providerPayloads = await exportProviderPayloads(projectId);
  const payload = getProviderPayloadByKind(providerPayloads.providers, provider);

  if (job.status === 'running' && existingMeta.pendingTasks && existingMeta.pendingTasks.length > 0) {
    return continueRunningRenderJob({
      projectId,
      project,
      jobId,
      provider,
      providerProfile,
      adapterConfig,
      existingMeta,
      payload,
    });
  }

  await prisma.renderJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      outputUrl: serializeRenderJobOutput({
        ...existingMeta,
        payloadCount: payload.length,
        pendingTasks: [],
        pollAttempts: existingMeta.pollAttempts || 0,
        taskStatus: undefined,
        summary: [...stripVolatileSummary(existingMeta.summary), 'status:running'],
      }),
    },
  });

  try {
    const result = await executeProvider(provider, { id: project.id, title: project.title }, payload);

    if (result.lifecycle === 'pending') {
      const summary = [...stripVolatileSummary(existingMeta.summary), ...result.summary, 'status:pending'];
      if (result.pollPath) summary.push(`pollPath:${result.pollPath}`);
      if (result.taskStatus) summary.push(`lastTaskStatus:${result.taskStatus}`);

      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: 'running',
          outputUrl: serializeRenderJobOutput({
            ...existingMeta,
            mode: result.mode,
            endpoint: result.endpoint || undefined,
            requestPath: result.requestPath,
            responsePath: result.responsePath,
            payloadCount: payload.length,
            retryCount: existingMeta.retryCount,
            preview: result.preview,
            executedAt: new Date().toISOString(),
            lastError: undefined,
            timeoutMs: result.timeoutMs,
            providerName: providerProfile.providerName,
            providerModel: providerProfile.providerModel || undefined,
            adapter: adapterConfig.mode,
            pollPath: result.pollPath || undefined,
            pollTracePath: result.pollTracePath || undefined,
            pollAttempts: result.pollAttempts,
            taskStatus: result.taskStatus || undefined,
            pendingTasks: result.pendingTasks,
            summary,
          }),
        },
      });
      return;
    }

    const mediaArtifacts = await syncGeneratedMediaArtifacts({
      projectId,
      provider,
      jobId,
      payload,
      runDir: result.runDir,
      requestPath: result.requestPath,
      responsePath: result.responsePath,
      responseBody: result.responseBody,
      mode: result.mode,
    });
    const summary = provider === 'video-assembly'
      ? [...stripVolatileSummary(existingMeta.summary), ...result.summary, 'final-cut:preview-ready']
      : provider === 'voice-synthesis'
        ? [...stripVolatileSummary(existingMeta.summary), ...result.summary, 'voice-track:generated']
        : [...stripVolatileSummary(existingMeta.summary), ...result.summary, 'frames:generated'];
    summary.push(`assets:${mediaArtifacts.entries.length}`);
    if (result.pollPath) summary.push(`pollPath:${result.pollPath}`);
    if (result.taskStatus) summary.push(`lastTaskStatus:${result.taskStatus}`);

    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        outputUrl: serializeRenderJobOutput({
          ...existingMeta,
          mode: result.mode,
          endpoint: result.endpoint || undefined,
          requestPath: result.requestPath,
          responsePath: result.responsePath,
          payloadCount: payload.length,
          retryCount: existingMeta.retryCount,
          preview: result.preview,
          executedAt: new Date().toISOString(),
          lastError: undefined,
          assetCount: mediaArtifacts.entries.length,
          artifactIndexPath: mediaArtifacts.indexPath,
          timeoutMs: result.timeoutMs,
          providerName: providerProfile.providerName,
          providerModel: providerProfile.providerModel || undefined,
          adapter: adapterConfig.mode,
          pollPath: result.pollPath || undefined,
          pollTracePath: result.pollTracePath || undefined,
          pollAttempts: result.pollAttempts,
          taskStatus: result.taskStatus || undefined,
          pendingTasks: [],
          summary,
        }),
      },
    });
  } catch (error) {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        outputUrl: serializeRenderJobOutput({
          ...existingMeta,
          payloadCount: payload.length,
          retryCount: existingMeta.retryCount + 1,
          executedAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : 'Unknown error',
          timeoutMs: getProviderTimeoutMs(provider),
          providerName: providerProfile.providerName,
          providerModel: providerProfile.providerModel || undefined,
          adapter: adapterConfig.mode,
          pendingTasks: [],
          summary: [...stripVolatileSummary(existingMeta.summary), 'status:failed'],
        }),
      },
    });
  }
}

export async function runRenderJobs(projectId: string, query?: RenderJobQuery) {
  const jobs = await findRenderJobs(projectId, ['queued', 'failed'], query);

  if (jobs.length === 0) throw new Error(buildRenderJobLabel(query, false));

  for (const job of jobs) {
    await executeRenderJob(projectId, job.id);
  }

  return getRenderProjectById(projectId);
}

export async function retryFailedRenderJobs(projectId: string, query?: RenderJobQuery) {
  const jobs = await findRenderJobs(projectId, ['failed'], query);

  if (jobs.length === 0) throw new Error(buildRenderJobLabel(query, true));

  for (const job of jobs) {
    await executeRenderJob(projectId, job.id);
  }

  return getRenderProjectById(projectId);
}

export async function advanceRenderJobs(projectId: string, query?: RenderJobQuery) {
  const jobs = await findRenderJobs(projectId, ['running'], query);

  if (jobs.length === 0) throw new Error(buildAdvanceJobLabel(query));

  for (const job of jobs) {
    await executeRenderJob(projectId, job.id);
  }

  return getRenderProjectById(projectId);
}
