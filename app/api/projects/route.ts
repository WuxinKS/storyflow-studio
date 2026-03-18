import { NextResponse } from 'next/server';
import { runProjectPipeline } from '@/features/pipeline/service';
import { createProjectWithIdea, listProjects } from '@/features/project/service';
import { getWorkflowGuide } from '@/features/workflow/service';
import { buildProjectHref } from '@/lib/project-links';

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ ok: true, projects });
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
    const project = await createProjectWithIdea(body);

    if (body.runPipelineMode === 'prepare' || body.runPipelineMode === 'full') {
      const pipeline = await runProjectPipeline(project.id, { mode: body.runPipelineMode });
      const workflow = await getWorkflowGuide(project.id);
      return NextResponse.json({
        ok: true,
        project: pipeline.project,
        run: pipeline.run,
        artifacts: pipeline.artifacts,
        workflow,
        nextActionHref: workflow ? buildProjectHref(workflow.nextAction.href, project.id) : buildProjectHref('/story-setup', project.id),
      }, { status: 201 });
    }

    const workflow = await getWorkflowGuide(project.id);
    return NextResponse.json({
      ok: true,
      project,
      workflow,
      nextActionHref: workflow ? buildProjectHref(workflow.nextAction.href, project.id) : buildProjectHref('/story-setup', project.id),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
