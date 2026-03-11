import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
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
  mediaCounts: GeneratedMediaCounts;
  providerCounts: {
    image: number;
    voice: number;
    video: number;
  };
  sizes: {
    bundleBytes: number | null;
    zipBytes: number | null;
  };
  files: {
    manifestPath: string;
    presetsPath: string;
    providersPath: string;
    generatedMediaPath: string;
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

type BundleManifest = {
  projectId?: string;
  projectTitle?: string;
  exportedAt?: string;
  visualBibleStyle?: string | null;
  characterSummary?: string | null;
};

type ProviderPayloadExport = {
  providers?: {
    imageSequence?: unknown[];
    voiceSynthesis?: unknown[];
    videoAssembly?: unknown[];
  };
};

const EMPTY_MEDIA_COUNTS: GeneratedMediaCounts = {
  total: 0,
  images: 0,
  audio: 0,
  videos: 0,
  remote: 0,
  mock: 0,
};

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
  const bundlePath = path.join(bundleDir, 'production-bundle.json');
  const bundleName = path.basename(bundleDir);
  const zipPath = path.join(path.dirname(bundleDir), `${bundleName}.zip`);

  const manifest = await readJsonFile<BundleManifest>(manifestPath);
  if (!manifest) return null;

  const providerPayloads = await readJsonFile<ProviderPayloadExport>(providersPath);
  const generatedMediaJson = await readJsonFile(generatedMediaPath);
  const mediaCounts = generatedMediaJson
    ? summarizeGeneratedMediaCounts(parseGeneratedMediaLibrary(JSON.stringify(generatedMediaJson)))
    : EMPTY_MEDIA_COUNTS;

  const [bundleBytes, zipBytes, directoryStat] = await Promise.all([
    getFileSize(bundlePath),
    getFileSize(zipPath),
    stat(bundleDir).catch(() => null),
  ]);

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
    mediaCounts,
    providerCounts: {
      image: Array.isArray(providerPayloads?.providers?.imageSequence) ? providerPayloads.providers.imageSequence.length : 0,
      voice: Array.isArray(providerPayloads?.providers?.voiceSynthesis) ? providerPayloads.providers.voiceSynthesis.length : 0,
      video: Array.isArray(providerPayloads?.providers?.videoAssembly) ? providerPayloads.providers.videoAssembly.length : 0,
    },
    sizes: {
      bundleBytes,
      zipBytes,
    },
    files: {
      manifestPath,
      presetsPath,
      providersPath,
      generatedMediaPath,
      bundlePath,
      zipPath: zipBytes ? zipPath : null,
    },
  } satisfies DeliveryBundleRecord;
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
