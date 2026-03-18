import { NextResponse } from 'next/server';
import { getWorkflowGuide } from '@/features/workflow/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const workflow = await getWorkflowGuide(projectId);
    return NextResponse.json({ ok: true, workflow });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
