import { NextResponse } from 'next/server';
import {
  generateNovelChapters,
  generateStoryDraft,
  generateStoryDraftPart,
  getLatestProject,
} from '@/features/story/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const project = await getLatestProject(projectId);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'generate';

    if (action === 'generate') {
      const project = await generateStoryDraft(body.projectId);
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (action === 'generate-synopsis') {
      const project = await generateStoryDraftPart(body.projectId, 'synopsis');
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (action === 'generate-beats') {
      const project = await generateStoryDraftPart(body.projectId, 'beats');
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (action === 'generate-scenes') {
      const project = await generateStoryDraftPart(body.projectId, 'scenes');
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (action === 'generate-chapters') {
      const project = await generateNovelChapters(body.projectId);
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: '不支持的 action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
