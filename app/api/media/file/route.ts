import path from 'node:path';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
};

function normalizePathInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(process.cwd(), trimmed);
}

function isAllowedPath(filePath: string) {
  const exportsRoot = path.resolve(process.cwd(), 'exports');
  return filePath === exportsRoot || filePath.startsWith(`${exportsRoot}${path.sep}`);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path') || '';
    const resolvedPath = normalizePathInput(rawPath);

    if (!resolvedPath) {
      return NextResponse.json({ ok: false, error: '缺少 path 参数' }, { status: 400 });
    }

    if (!isAllowedPath(resolvedPath)) {
      return NextResponse.json({ ok: false, error: '只允许访问 exports 目录下的文件' }, { status: 403 });
    }

    const fileStat = await stat(resolvedPath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) {
      return NextResponse.json({ ok: false, error: '文件不存在' }, { status: 404 });
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_BY_EXTENSION[extension] || 'application/octet-stream';
    const stream = createReadStream(resolvedPath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileStat.size),
        'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(resolvedPath))}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
