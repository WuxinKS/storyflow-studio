import { NextResponse } from 'next/server';
import { createChapter } from '@/features/story/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const chapter = await createChapter(body);
    return NextResponse.json({ ok: true, chapter }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
