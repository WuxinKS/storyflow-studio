import { NextResponse } from 'next/server';
import {
  createProjectSnapshot,
  getProjectSnapshotWorkspace,
  restoreProjectSnapshot,
  type ProjectSnapshotRestoreScope,
} from '@/features/project-snapshot/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const workspace = await getProjectSnapshotWorkspace(projectId);
    return NextResponse.json({ ok: true, workspace });
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
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';

    if (!projectId) {
      return NextResponse.json({ ok: false, error: 'projectId 缺失' }, { status: 400 });
    }

    if (action === 'create') {
      const snapshot = await createProjectSnapshot(projectId, body.label);
      return NextResponse.json({ ok: true, snapshot }, { status: 201 });
    }

    if (action === 'restore') {
      const snapshotId = typeof body.snapshotId === 'string' ? body.snapshotId : '';
      if (!snapshotId) {
        return NextResponse.json({ ok: false, error: 'snapshotId 缺失' }, { status: 400 });
      }

      const scope = (typeof body.scope === 'string' ? body.scope : 'full') as ProjectSnapshotRestoreScope;
      const result = await restoreProjectSnapshot(projectId, snapshotId, scope);
      return NextResponse.json({ ok: true, result }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: '不支持的 action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
