import { NextResponse } from 'next/server';
import { generateVisualBible, getLatestVisualProject, saveVisualBible } from '@/features/visual/service';

export async function GET() {
  try {
    const project = await getLatestVisualProject();
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
      const project = await generateVisualBible(body.projectId, { focus: body.focus || 'all' });
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (action === 'save') {
      const project = await saveVisualBible(body.projectId, body.draft || {});
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
