import path from 'node:path';

export type PreviewKind = 'image' | 'audio' | 'video';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v']);

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim();
}

export function getPreviewKindFromGeneratedType(type: string | null | undefined): PreviewKind | null {
  if (type === 'generated-image') return 'image';
  if (type === 'generated-audio') return 'audio';
  if (type === 'generated-video') return 'video';
  return null;
}

export function getPreviewKindFromExtension(value: string | null | undefined): PreviewKind | null {
  const normalized = normalizeText(value).split('?')[0].split('#')[0];
  const ext = path.extname(normalized).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}

export function isLikelyRemoteSource(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return /^(https?:\/\/|data:|blob:|\/)/i.test(normalized);
}

export function isWorkspaceExportPath(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized.includes(`${path.sep}exports${path.sep}`) || normalized.startsWith(`exports${path.sep}`) || normalized === 'exports';
}

export function buildLocalMediaPreviewHref(localPath: string) {
  return `/api/media/file?path=${encodeURIComponent(localPath)}`;
}

export function resolvePreviewSource(input: {
  kind?: PreviewKind | null;
  sourceUrl?: string | null;
  localPath?: string | null;
}) {
  const sourceUrl = normalizeText(input.sourceUrl);
  const localPath = normalizeText(input.localPath);

  if (sourceUrl && isLikelyRemoteSource(sourceUrl)) {
    return sourceUrl;
  }

  if (localPath && isWorkspaceExportPath(localPath)) {
    return buildLocalMediaPreviewHref(localPath);
  }

  return null;
}
