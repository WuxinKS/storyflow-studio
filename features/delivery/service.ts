import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { prisma } from '@/lib/prisma';
import { parseRenderJobOutput } from '@/features/render/service';
import {
  parseGeneratedMediaLibrary,
  summarizeGeneratedMediaCounts,
  type GeneratedMediaCounts,
} from '@/features/media/service';

export type DeliveryBundleRecord = {
  bundleName: string;
  projectId: string | null;
  projectTitle: string;
  exportedAt: string;
  bundleDir: string;
  styleName: string | null;
  characterSummary: string | null;
  providerProfiles: Array<{
    provider: string;
    providerName: string | null;
    providerModel: string | null;
    executionModeHint: string | null;
  }>;
  mediaCounts: GeneratedMediaCounts;
  providerCounts: {
    image: number;
    voice: number;
    video: number;
  };
  assemblyState: string | null;
  readyForAssembly: boolean;
  readyForFullVideo: boolean;
  sizes: {
    bundleBytes: number | null;
    zipBytes: number | null;
  };
  files: {
    manifestPath: string;
    presetsPath: string;
    providersPath: string;
    generatedMediaPath: string;
    finalCutPath: string;
    finalCutAssemblyPath: string | null;
    finalCutSegmentsPath: string | null;
    finalCutAudioSegmentsPath: string | null;
    finalCutScriptPath: string | null;
    bundlePath: string;
    zipPath: string | null;
  };
};

export type DeliveryCenterData = {
  bundles: DeliveryBundleRecord[];
  summary: {
    total: number;
    latestExportAt: string | null;
    totalMedia: GeneratedMediaCounts;
    totalProviderPayloads: {
      image: number;
      voice: number;
      video: number;
    };
  };
};

export type RenderRunProviderRecord = {
  provider: string;
  providerName: string | null;
  providerModel: string | null;
  requestPath: string | null;
  responsePath: string | null;
  payloadCount: number;
  sceneCount: number;
  shotCount: number;
  referencePayloadCount: number;
  boundPayloadCount: number;
  sourceMediaCount: number;
  referenceTitles: string[];
  mode: 'mock' | 'remote' | 'unknown';
  itemCount: number | null;
  generatedAt: string | null;
  message: string | null;
  responsePreview: string | null;
  sizes: {
    requestBytes: number | null;
    responseBytes: number | null;
  };
  matchedJob: {
    id: string;
    status: string;
    mode: string;
    executedAt: string | null;
    assetCount: number;
    retryCount: number;
    endpoint: string | null;
    artifactIndexPath: string | null;
    lastError: string | null;
    providerName: string | null;
    providerModel: string | null;
    adapter: string | null;
    pollPath: string | null;
    pollTracePath: string | null;
    pollAttempts: number;
    taskStatus: string | null;
    pendingTasks: number;
  } | null;
};

export type RenderRunRecord = {
  runName: string;
  runDir: string;
  projectId: string | null;
  projectTitle: string;
  createdAt: string;
  providers: RenderRunProviderRecord[];
  summary: {
    providerCount: number;
    totalPayloadItems: number;
    totalSceneItems: number;
    totalShotItems: number;
    totalReferenceItems: number;
    totalBoundItems: number;
    totalSourceMedia: number;
    remoteProviders: number;
    mockProviders: number;
    assetCount: number;
  };
};

export type RenderRunCenterData = {
  runs: RenderRunRecord[];
  summary: {
    total: number;
    latestRunAt: string | null;
    projectCount: number;
    providerCount: number;
    remoteProviders: number;
    mockProviders: number;
    totalPayloadItems: number;
    totalReferenceItems: number;
    totalBoundItems: number;
    totalSourceMedia: number;
  };
};

type BundleManifest = {
  projectId?: string;
  projectTitle?: string;
  exportedAt?: string;
  visualBibleStyle?: string | null;
  characterSummary?: string | null;
};

type FinalCutPlanExport = {
  plan?: {
    summary?: {
      assemblyState?: string;
      readyForAssembly?: boolean;
      readyForFullVideo?: boolean;
    };
  };
};

type ProviderPayloadExport = {
  providers?: {
    imageSequence?: unknown[];
    voiceSynthesis?: unknown[];
    videoAssembly?: unknown[];
  };
  providerProfiles?: {
    imageSequence?: Record<string, unknown>;
    voiceSynthesis?: Record<string, unknown>;
    videoAssembly?: Record<string, unknown>;
  };
};

type RenderJobLookupRecord = {
  projectId: string;
  projectTitle: string;
  jobId: string;
  jobStatus: string;
  provider: string | null;
  meta: ReturnType<typeof parseRenderJobOutput>;
};

const EMPTY_MEDIA_COUNTS: GeneratedMediaCounts = {
  total: 0,
  images: 0,
  audio: 0,
  videos: 0,
  remote: 0,
  mock: 0,
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function toRecord(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return uniqueValues(value.map((item) => normalizeText(item)).filter(Boolean));
}

function pickString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = normalizeText(record[key]);
    if (value) return value;
  }
  return null;
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function extractRequestItems(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => toRecord(item)).filter(Boolean) as Array<Record<string, unknown>>;
  }

  const record = toRecord(value);
  if (!record) return [] as Array<Record<string, unknown>>;

  if (Array.isArray(record.items)) {
    return record.items.map((item) => toRecord(item)).filter(Boolean) as Array<Record<string, unknown>>;
  }

  return [] as Array<Record<string, unknown>>;
}

async function readJsonFile<T>(filePath: string) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function getFileSize(filePath: string) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile() ? fileStat.size : null;
  } catch {
    return null;
  }
}

async function loadBundleRecord(bundleDir: string) {
  const manifestPath = path.join(bundleDir, 'manifest.json');
  const presetsPath = path.join(bundleDir, 'render-presets.json');
  const providersPath = path.join(bundleDir, 'provider-payloads.json');
  const generatedMediaPath = path.join(bundleDir, 'generated-media-library.json');
  const finalCutPath = path.join(bundleDir, 'final-cut-plan.json');
  const finalCutAssemblyPath = path.join(bundleDir, 'final-cut-assembly.json');
  const finalCutSegmentsPath = path.join(bundleDir, 'final-cut-segments.txt');
  const finalCutAudioSegmentsPath = path.join(bundleDir, 'final-cut-audio-segments.txt');
  const finalCutScriptPath = path.join(bundleDir, 'assemble-final-cut.sh');
  const bundlePath = path.join(bundleDir, 'production-bundle.json');
  const bundleName = path.basename(bundleDir);
  const zipPath = path.join(path.dirname(bundleDir), `${bundleName}.zip`);

  const manifest = await readJsonFile<BundleManifest>(manifestPath);
  if (!manifest) return null;

  const providerPayloads = await readJsonFile<ProviderPayloadExport>(providersPath);
  const generatedMediaJson = await readJsonFile(generatedMediaPath);
  const finalCutJson = await readJsonFile<FinalCutPlanExport>(finalCutPath);
  const mediaCounts = generatedMediaJson
    ? summarizeGeneratedMediaCounts(parseGeneratedMediaLibrary(JSON.stringify(generatedMediaJson)))
    : EMPTY_MEDIA_COUNTS;

  const [bundleBytes, zipBytes, assemblyBytes, segmentsBytes, audioSegmentsBytes, scriptBytes, directoryStat] = await Promise.all([
    getFileSize(bundlePath),
    getFileSize(zipPath),
    getFileSize(finalCutAssemblyPath),
    getFileSize(finalCutSegmentsPath),
    getFileSize(finalCutAudioSegmentsPath),
    getFileSize(finalCutScriptPath),
    stat(bundleDir).catch(() => null),
  ]);

  const providerProfiles = [
    {
      provider: 'image-sequence',
      providerName: pickString(toRecord(providerPayloads?.providerProfiles?.imageSequence), ['providerName']),
      providerModel: pickString(toRecord(providerPayloads?.providerProfiles?.imageSequence), ['providerModel']),
      executionModeHint: pickString(toRecord(providerPayloads?.providerProfiles?.imageSequence), ['executionModeHint']),
    },
    {
      provider: 'voice-synthesis',
      providerName: pickString(toRecord(providerPayloads?.providerProfiles?.voiceSynthesis), ['providerName']),
      providerModel: pickString(toRecord(providerPayloads?.providerProfiles?.voiceSynthesis), ['providerModel']),
      executionModeHint: pickString(toRecord(providerPayloads?.providerProfiles?.voiceSynthesis), ['executionModeHint']),
    },
    {
      provider: 'video-assembly',
      providerName: pickString(toRecord(providerPayloads?.providerProfiles?.videoAssembly), ['providerName']),
      providerModel: pickString(toRecord(providerPayloads?.providerProfiles?.videoAssembly), ['providerModel']),
      executionModeHint: pickString(toRecord(providerPayloads?.providerProfiles?.videoAssembly), ['executionModeHint']),
    },
  ].filter((item) => item.providerName || item.providerModel || item.executionModeHint);

  const exportedAt = typeof manifest.exportedAt === 'string' && manifest.exportedAt.trim()
    ? manifest.exportedAt
    : directoryStat?.mtime.toISOString() || new Date(0).toISOString();

  return {
    bundleName,
    projectId: typeof manifest.projectId === 'string' ? manifest.projectId : null,
    projectTitle: typeof manifest.projectTitle === 'string' && manifest.projectTitle.trim()
      ? manifest.projectTitle.trim()
      : bundleName,
    exportedAt,
    bundleDir,
    styleName: typeof manifest.visualBibleStyle === 'string' ? manifest.visualBibleStyle : null,
    characterSummary: typeof manifest.characterSummary === 'string' ? manifest.characterSummary : null,
    providerProfiles,
    mediaCounts,
    providerCounts: {
      image: Array.isArray(providerPayloads?.providers?.imageSequence) ? providerPayloads.providers.imageSequence.length : 0,
      voice: Array.isArray(providerPayloads?.providers?.voiceSynthesis) ? providerPayloads.providers.voiceSynthesis.length : 0,
      video: Array.isArray(providerPayloads?.providers?.videoAssembly) ? providerPayloads.providers.videoAssembly.length : 0,
    },
    assemblyState: pickString(finalCutJson?.plan?.summary ? finalCutJson.plan.summary as Record<string, unknown> : null, ['assemblyState']),
    readyForAssembly: Boolean(finalCutJson?.plan?.summary?.readyForAssembly),
    readyForFullVideo: Boolean(finalCutJson?.plan?.summary?.readyForFullVideo),
    sizes: {
      bundleBytes,
      zipBytes,
    },
    files: {
      manifestPath,
      presetsPath,
      providersPath,
      generatedMediaPath,
      finalCutPath,
      finalCutAssemblyPath: assemblyBytes ? finalCutAssemblyPath : null,
      finalCutSegmentsPath: segmentsBytes ? finalCutSegmentsPath : null,
      finalCutAudioSegmentsPath: audioSegmentsBytes ? finalCutAudioSegmentsPath : null,
      finalCutScriptPath: scriptBytes ? finalCutScriptPath : null,
      bundlePath,
      zipPath: zipBytes ? zipPath : null,
    },
  } satisfies DeliveryBundleRecord;
}

async function buildRenderJobLookup() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      renderJobs: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          provider: true,
          outputUrl: true,
        },
      },
    },
  });

  const byPath = new Map<string, RenderJobLookupRecord>();
  const byRunProvider = new Map<string, RenderJobLookupRecord>();

  for (const project of projects) {
    for (const job of project.renderJobs) {
      const meta = parseRenderJobOutput(job.outputUrl);
      const lookupRecord: RenderJobLookupRecord = {
        projectId: project.id,
        projectTitle: project.title,
        jobId: job.id,
        jobStatus: job.status,
        provider: job.provider,
        meta,
      };

      const requestPath = normalizeText(meta.requestPath);
      const responsePath = normalizeText(meta.responsePath);
      if (requestPath) byPath.set(path.resolve(requestPath), lookupRecord);
      if (responsePath) byPath.set(path.resolve(responsePath), lookupRecord);

      const runDir = requestPath
        ? path.dirname(path.resolve(requestPath))
        : responsePath
          ? path.dirname(path.resolve(responsePath))
          : '';

      if (runDir && job.provider) {
        byRunProvider.set(`${runDir}::${job.provider}`, lookupRecord);
      }
    }
  }

  return { byPath, byRunProvider };
}

async function loadRenderRunRecord(
  runDir: string,
  jobLookup: Awaited<ReturnType<typeof buildRenderJobLookup>>,
) {
  const directoryEntries = await readdir(runDir, { withFileTypes: true }).catch(() => [] as Awaited<ReturnType<typeof readdir>>);
  if (directoryEntries.length === 0) return null;

  const providerFiles = new Map<string, { requestPath: string | null; responsePath: string | null }>();

  for (const entry of directoryEntries) {
    if (!entry.isFile()) continue;
    const provider = entry.name.endsWith('-request.json')
      ? entry.name.replace(/-request\.json$/, '')
      : entry.name.endsWith('-response.json')
        ? entry.name.replace(/-response\.json$/, '')
        : '';

    if (!provider) continue;

    const current = providerFiles.get(provider) || { requestPath: null, responsePath: null };
    const filePath = path.join(runDir, entry.name);
    if (entry.name.endsWith('-request.json')) current.requestPath = filePath;
    if (entry.name.endsWith('-response.json')) current.responsePath = filePath;
    providerFiles.set(provider, current);
  }

  const directoryStat = await stat(runDir).catch(() => null);
  const providers = (await Promise.all(Array.from(providerFiles.entries()).map(async ([provider, files]) => {
    const [requestJson, responseJson, requestBytes, responseBytes] = await Promise.all([
      files.requestPath ? readJsonFile<unknown>(files.requestPath) : Promise.resolve(null),
      files.responsePath ? readJsonFile<unknown>(files.responsePath) : Promise.resolve(null),
      files.requestPath ? getFileSize(files.requestPath) : Promise.resolve(null),
      files.responsePath ? getFileSize(files.responsePath) : Promise.resolve(null),
    ]);

    const requestItems = extractRequestItems(requestJson);
    const sceneIds = new Set<string>();
    const shotIds = new Set<string>();
    const allReferenceTitles = new Set<string>();
    const sourceMedia = new Set<string>();
    let referencePayloadCount = 0;
    let boundPayloadCount = 0;

    for (const item of requestItems) {
      const sceneId = normalizeText(item.sceneId);
      const shotId = normalizeText(item.shotId);
      if (sceneId) sceneIds.add(sceneId);
      if (shotId) shotIds.add(shotId);

      const boundTitles = toStringArray(item.boundReferenceTitles);
      const genericTitles = toStringArray(item.referenceTitles);
      const combinedTitles = uniqueValues([...boundTitles, ...genericTitles]);
      if (combinedTitles.length > 0) referencePayloadCount += 1;
      if (boundTitles.length > 0) boundPayloadCount += 1;
      combinedTitles.forEach((title) => allReferenceTitles.add(title));

      [
        ...toStringArray(item.boundReferenceSourceUrls),
        ...toStringArray(item.boundReferenceLocalPaths),
        ...toStringArray(item.referenceSourceUrls),
        ...toStringArray(item.referenceLocalPaths),
      ].forEach((source) => sourceMedia.add(source));
    }

    const responseRecord = toRecord(responseJson);
    const providerNames = uniqueValues(requestItems.map((item) => normalizeText(item.providerName)).filter(Boolean));
    const providerModels = uniqueValues(requestItems.map((item) => normalizeText(item.providerModel)).filter(Boolean));
    const requestLookupPath = files.requestPath ? path.resolve(files.requestPath) : '';
    const responseLookupPath = files.responsePath ? path.resolve(files.responsePath) : '';
    const matched = (requestLookupPath && jobLookup.byPath.get(requestLookupPath))
      || (responseLookupPath && jobLookup.byPath.get(responseLookupPath))
      || jobLookup.byRunProvider.get(`${path.resolve(runDir)}::${provider}`)
      || null;

    const modeFromResponse = pickString(responseRecord, ['mode']);
    const mode = modeFromResponse === 'mock' || modeFromResponse === 'remote'
      ? modeFromResponse
      : matched?.meta.mode === 'mock' || matched?.meta.mode === 'remote'
        ? matched.meta.mode
        : 'unknown';

    const responseMessage = pickString(responseRecord, ['message', 'summary', 'detail', 'description', 'statusText']);
    const responsePreview = typeof responseJson === 'string'
      ? responseJson.trim().slice(0, 180)
      : responseMessage;

    return {
      provider,
      providerName: providerNames[0] || pickString(responseRecord, ['providerName']) || matched?.meta.providerName || null,
      providerModel: providerModels[0] || pickString(responseRecord, ['providerModel']) || matched?.meta.providerModel || null,
      requestPath: files.requestPath,
      responsePath: files.responsePath,
      payloadCount: requestItems.length,
      sceneCount: sceneIds.size,
      shotCount: shotIds.size,
      referencePayloadCount,
      boundPayloadCount,
      sourceMediaCount: sourceMedia.size,
      referenceTitles: Array.from(allReferenceTitles).slice(0, 8),
      mode,
      itemCount: pickNumber(responseRecord, ['itemCount', 'count', 'total']) ?? requestItems.length,
      generatedAt: pickString(responseRecord, ['generatedAt', 'createdAt']) || matched?.meta.executedAt || null,
      message: responseMessage,
      responsePreview,
      sizes: {
        requestBytes,
        responseBytes,
      },
      matchedJob: matched
        ? {
            id: matched.jobId,
            status: matched.jobStatus,
            mode: matched.meta.mode,
            executedAt: matched.meta.executedAt || null,
            assetCount: matched.meta.assetCount || 0,
            retryCount: matched.meta.retryCount,
            endpoint: matched.meta.endpoint || null,
            artifactIndexPath: matched.meta.artifactIndexPath || null,
            lastError: matched.meta.lastError || null,
            providerName: matched.meta.providerName || null,
            providerModel: matched.meta.providerModel || null,
            adapter: matched.meta.adapter || null,
            pollPath: matched.meta.pollPath || null,
            pollTracePath: matched.meta.pollTracePath || null,
            pollAttempts: matched.meta.pollAttempts || 0,
            taskStatus: matched.meta.taskStatus || null,
            pendingTasks: Array.isArray(matched.meta.pendingTasks) ? matched.meta.pendingTasks.length : 0,
          }
        : null,
    } satisfies RenderRunProviderRecord;
  }))).filter(Boolean) as RenderRunProviderRecord[];

  if (providers.length === 0) return null;

  const projectId = providers.find((item) => item.matchedJob)?.matchedJob
    ? jobLookup.byRunProvider.get(`${path.resolve(runDir)}::${providers.find((item) => item.matchedJob)?.provider || ''}`)?.projectId || null
    : null;
  const projectTitle = providers.find((item) => item.matchedJob)
    ? jobLookup.byRunProvider.get(`${path.resolve(runDir)}::${providers.find((item) => item.matchedJob)?.provider || ''}`)?.projectTitle || path.basename(runDir)
    : path.basename(runDir);

  const createdAtCandidates = providers
    .map((item) => item.generatedAt)
    .filter(Boolean) as string[];
  const createdAt = createdAtCandidates.sort().reverse()[0] || directoryStat?.mtime.toISOString() || new Date(0).toISOString();

  return {
    runName: path.basename(runDir),
    runDir,
    projectId,
    projectTitle,
    createdAt,
    providers,
    summary: {
      providerCount: providers.length,
      totalPayloadItems: providers.reduce((sum, item) => sum + item.payloadCount, 0),
      totalSceneItems: providers.reduce((sum, item) => sum + item.sceneCount, 0),
      totalShotItems: providers.reduce((sum, item) => sum + item.shotCount, 0),
      totalReferenceItems: providers.reduce((sum, item) => sum + item.referencePayloadCount, 0),
      totalBoundItems: providers.reduce((sum, item) => sum + item.boundPayloadCount, 0),
      totalSourceMedia: providers.reduce((sum, item) => sum + item.sourceMediaCount, 0),
      remoteProviders: providers.filter((item) => item.mode === 'remote').length,
      mockProviders: providers.filter((item) => item.mode === 'mock').length,
      assetCount: providers.reduce((sum, item) => sum + (item.matchedJob?.assetCount || 0), 0),
    },
  } satisfies RenderRunRecord;
}

export async function listDeliveryBundles(projectId?: string, limit = 12) {
  const exportsRoot = path.join(process.cwd(), 'exports');

  let directoryEntries: Awaited<ReturnType<typeof readdir>> = [];
  try {
    directoryEntries = await readdir(exportsRoot, { withFileTypes: true });
  } catch {
    return [] as DeliveryBundleRecord[];
  }

  const bundleDirs = directoryEntries
    .filter((entry) => entry.isDirectory() && entry.name !== 'render-runs')
    .map((entry) => path.join(exportsRoot, entry.name));

  const records = (await Promise.all(bundleDirs.map((bundleDir) => loadBundleRecord(bundleDir))))
    .filter(Boolean)
    .filter((item) => !projectId || item?.projectId === projectId) as DeliveryBundleRecord[];

  return records
    .sort((left, right) => right.exportedAt.localeCompare(left.exportedAt))
    .slice(0, Math.max(limit, 1));
}

export async function getDeliveryCenterData(projectId?: string, limit = 12): Promise<DeliveryCenterData> {
  const bundles = await listDeliveryBundles(projectId, limit);

  const totalMedia = bundles.reduce<GeneratedMediaCounts>((accumulator, bundle) => ({
    total: accumulator.total + bundle.mediaCounts.total,
    images: accumulator.images + bundle.mediaCounts.images,
    audio: accumulator.audio + bundle.mediaCounts.audio,
    videos: accumulator.videos + bundle.mediaCounts.videos,
    remote: accumulator.remote + bundle.mediaCounts.remote,
    mock: accumulator.mock + bundle.mediaCounts.mock,
  }), EMPTY_MEDIA_COUNTS);

  const totalProviderPayloads = bundles.reduce(
    (accumulator, bundle) => ({
      image: accumulator.image + bundle.providerCounts.image,
      voice: accumulator.voice + bundle.providerCounts.voice,
      video: accumulator.video + bundle.providerCounts.video,
    }),
    { image: 0, voice: 0, video: 0 },
  );

  return {
    bundles,
    summary: {
      total: bundles.length,
      latestExportAt: bundles[0]?.exportedAt || null,
      totalMedia,
      totalProviderPayloads,
    },
  };
}

export async function listRenderRuns(projectId?: string, limit = 12) {
  const runsRoot = path.join(process.cwd(), 'exports', 'render-runs');

  let directoryEntries: Awaited<ReturnType<typeof readdir>> = [];
  try {
    directoryEntries = await readdir(runsRoot, { withFileTypes: true });
  } catch {
    return [] as RenderRunRecord[];
  }

  const jobLookup = await buildRenderJobLookup();
  const runDirs = directoryEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(runsRoot, entry.name));

  const records = (await Promise.all(runDirs.map((runDir) => loadRenderRunRecord(runDir, jobLookup))))
    .filter(Boolean)
    .filter((item) => !projectId || item?.projectId === projectId) as RenderRunRecord[];

  return records
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, Math.max(limit, 1));
}

export async function getRenderRunCenterData(projectId?: string, limit = 12): Promise<RenderRunCenterData> {
  const runs = await listRenderRuns(projectId, limit);
  const projects = new Set(runs.map((run) => run.projectId).filter(Boolean));

  return {
    runs,
    summary: {
      total: runs.length,
      latestRunAt: runs[0]?.createdAt || null,
      projectCount: projects.size,
      providerCount: runs.reduce((sum, run) => sum + run.summary.providerCount, 0),
      remoteProviders: runs.reduce((sum, run) => sum + run.summary.remoteProviders, 0),
      mockProviders: runs.reduce((sum, run) => sum + run.summary.mockProviders, 0),
      totalPayloadItems: runs.reduce((sum, run) => sum + run.summary.totalPayloadItems, 0),
      totalReferenceItems: runs.reduce((sum, run) => sum + run.summary.totalReferenceItems, 0),
      totalBoundItems: runs.reduce((sum, run) => sum + run.summary.totalBoundItems, 0),
      totalSourceMedia: runs.reduce((sum, run) => sum + run.summary.totalSourceMedia, 0),
    },
  };
}
