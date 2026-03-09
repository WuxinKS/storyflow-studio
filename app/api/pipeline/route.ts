import { NextResponse } from 'next/server';
import { runProjectPipeline } from '@/features/pipeline/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await runProjectPipeline(body.projectId, { mode: body.mode || 'full' });
    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
