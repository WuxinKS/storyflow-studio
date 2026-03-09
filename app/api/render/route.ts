import { NextResponse } from 'next/server';
import {
  advanceRenderJobs,
  createRenderJobsForLatestProject,
  exportProductionBundle,
  exportProviderPayloads,
  exportRenderPresets,
  getRenderProject,
  retryFailedRenderJobs,
  runRenderJobs,
} from '@/features/render/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const projectId = searchParams.get('projectId');

    if (action === 'export-presets') {
      if (!projectId) {
        return NextResponse.json({ ok: false, error: '缺少 projectId' }, { status: 400 });
      }
      const data = await exportRenderPresets(projectId);
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'export-provider-payloads') {
      if (!projectId) {
        return NextResponse.json({ ok: false, error: '缺少 projectId' }, { status: 400 });
      }
      const data = await exportProviderPayloads(projectId);
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'export-production-bundle') {
      if (!projectId) {
        return NextResponse.json({ ok: false, error: '缺少 projectId' }, { status: 400 });
      }
      const data = await exportProductionBundle(projectId);
      return NextResponse.json({ ok: true, data });
    }

    const project = await getRenderProject();
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

    const project =
      action === 'run'
        ? await runRenderJobs(body.projectId)
        : action === 'retry'
          ? await retryFailedRenderJobs(body.projectId)
          : action === 'advance'
            ? await advanceRenderJobs(body.projectId)
            : await createRenderJobsForLatestProject(body.projectId);

    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
