import { NextResponse } from 'next/server';
import { getTimelineBundle, saveTimelineOverrides } from '@/features/timeline/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const timeline = await getTimelineBundle(projectId);
    return NextResponse.json({ ok: true, timeline });
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
    const timeline = await saveTimelineOverrides(body.projectId, body.overrides || []);
    return NextResponse.json({ ok: true, timeline }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
