import { NextResponse } from 'next/server';
import { generateAdaptationFromLatestChapter, getLatestProjectWithChapters } from '@/features/adaptation/service';

export async function GET() {
  try {
    const project = await getLatestProjectWithChapters();
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
    const project = await generateAdaptationFromLatestChapter(body.projectId);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
