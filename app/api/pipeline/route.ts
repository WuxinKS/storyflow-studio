import { NextResponse } from 'next/server';
import { runProjectPipeline } from '@/features/pipeline/service';
import { getWorkflowGuide } from '@/features/workflow/service';
import { buildProjectHref } from '@/lib/project-links';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await runProjectPipeline(body.projectId, { mode: body.mode || 'full' });
    const workflow = await getWorkflowGuide(body.projectId);
    return NextResponse.json({
      ok: true,
      ...data,
      workflow,
      nextActionHref: workflow ? buildProjectHref(workflow.nextAction.href, body.projectId) : buildProjectHref('/render-studio', body.projectId),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
