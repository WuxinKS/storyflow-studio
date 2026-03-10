import { NextResponse } from 'next/server';
import { runProjectPipeline } from '@/features/pipeline/service';
import { createProjectWithIdea, listProjects } from '@/features/project/service';

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
      return NextResponse.json({ ok: true, project: pipeline.project, run: pipeline.run }, { status: 201 });
    }

    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
