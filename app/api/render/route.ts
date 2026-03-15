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
import { exportFinalCutAssemblyPackage, getFinalCutPlan, runFinalCutPreviewAssembly } from '@/features/final-cut/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const projectId = searchParams.get('projectId') || undefined;

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

    if (action === 'export-final-cut-plan') {
      if (!projectId) {
        return NextResponse.json({ ok: false, error: '缺少 projectId' }, { status: 400 });
      }
      const data = await getFinalCutPlan(projectId);
      if (!data) {
        return NextResponse.json({ ok: false, error: '当前还没有可导出的成片计划' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'export-final-cut-assembly') {
      if (!projectId) {
        return NextResponse.json({ ok: false, error: '缺少 projectId' }, { status: 400 });
      }
      const data = await exportFinalCutAssemblyPackage(projectId);
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'assemble-final-cut-preview') {
      if (!projectId) {
        return NextResponse.json({ ok: false, error: '缺少 projectId' }, { status: 400 });
      }
      const data = await runFinalCutPreviewAssembly(projectId);
      if (searchParams.get('open') === '1') {
        const redirectUrl = new URL(`/api/media/file?path=${encodeURIComponent(data.files.previewMuxedPath)}`, request.url);
        return NextResponse.redirect(redirectUrl);
      }
      return NextResponse.json({ ok: true, data });
    }

    const project = await getRenderProject(projectId);
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
        ? await runRenderJobs(body.projectId, { provider: body.provider, jobId: body.jobId })
        : action === 'retry'
          ? await retryFailedRenderJobs(body.projectId, { provider: body.provider, jobId: body.jobId })
          : action === 'advance'
            ? await advanceRenderJobs(body.projectId, { provider: body.provider, jobId: body.jobId })
            : await createRenderJobsForLatestProject(body.projectId);

    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
