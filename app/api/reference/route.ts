import { NextResponse } from 'next/server';
import { createReferenceAnalysis, getReferenceProject, saveReferenceBinding } from '@/features/reference/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const project = await getReferenceProject(projectId);
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
    const action = body.action || 'create';
    const project = action === 'bind'
      ? await saveReferenceBinding({
          projectId: body.projectId,
          targetType: body.targetType,
          targetId: body.targetId,
          referenceIds: Array.isArray(body.referenceIds) ? body.referenceIds.map((item: unknown) => String(item)) : [],
          note: body.note,
        })
      : await createReferenceAnalysis(body);

    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
