import { resolvePreviewSource, type PreviewKind } from '@/lib/media-preview';

export function MediaPreview({
  kind,
  title,
  sourceUrl,
  localPath,
  fallbackLabel,
}: {
  kind: PreviewKind | null;
  title: string;
  sourceUrl?: string | null;
  localPath?: string | null;
  fallbackLabel?: string;
}) {
  const src = kind ? resolvePreviewSource({ kind, sourceUrl, localPath }) : null;

  if (!kind || !src) {
    return (
      <div className="media-preview-shell media-preview-empty">
        <span>{fallbackLabel || title}</span>
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className="media-preview-shell">
        <img className="media-preview-visual" src={src} alt={title} />
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="media-preview-shell">
        <video className="media-preview-visual" src={src} controls muted playsInline preload="metadata" />
      </div>
    );
  }

  return (
    <div className="media-preview-shell media-preview-audio">
      <audio className="media-preview-audio-control" src={src} controls preload="metadata" />
    </div>
  );
}
