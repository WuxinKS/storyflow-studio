import { NextResponse } from 'next/server';
import { generateCharacterDrafts, getLatestCharacterProject, saveCharacterDrafts } from '@/features/characters/service';

export async function GET() {
  try {
    const project = await getLatestCharacterProject();
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
      const project = await generateCharacterDrafts(body.projectId, { targetRole: body.targetRole });
      return NextResponse.json({ ok: true, project }, { status: 201 });
    }

    if (action === 'save') {
      const project = await saveCharacterDrafts(body.projectId, body.characters || []);
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
