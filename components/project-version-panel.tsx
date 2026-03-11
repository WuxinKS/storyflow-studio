import { ProjectSnapshotCreateButton } from '@/components/project-snapshot-create-button';
import { ProjectSnapshotRestoreButton } from '@/components/project-snapshot-restore-button';
import {
  getProjectSnapshotWorkspace,
  type ProjectSnapshotSummary,
} from '@/features/project-snapshot/service';
import { getProjectStageLabel } from '@/lib/display';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export async function ProjectVersionPanel({ projectId }: { projectId?: string }) {
  const workspace = await getProjectSnapshotWorkspace(projectId).catch(() => null);

  if (!workspace?.project) {
    return (
      <div className="snapshot-card">
        <p className="eyebrow">版本回溯</p>
        <h3>暂无项目可快照</h3>
        <p>先创建一个项目，系统才可以把故事、章节、镜头与渲染状态保存成可回滚版本。</p>
      </div>
    );
  }

  const { project, snapshots } = workspace;
  const recentSnapshots: ProjectSnapshotSummary[] = snapshots.slice(0, 6);

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">版本回溯</p>
        <h3>项目快照 / 安全回滚</h3>
        <p>现在可以把当前项目整体状态打成快照，并在需要时恢复。恢复前系统会自动备份一次当前状态，适合在“小说定稿 / 自动分镜前 / 真实渲染联调前”做版本冻结。</p>
        <div className="meta-list">
          <span>当前项目：{project.title}</span>
          <span>阶段：{getProjectStageLabel(project.stage)}</span>
          <span>章节：{project.stats.chapters}</span>
          <span>分场：{project.stats.scenes}</span>
          <span>镜头：{project.stats.shots}</span>
          <span>渲染任务：{project.stats.renderJobs}</span>
          <span>快照数：{snapshots.length}</span>
          <span>最近更新：{formatDateTime(project.updatedAt)}</span>
        </div>
        <ProjectSnapshotCreateButton projectId={project.id} />
      </div>

      <div className="asset-grid three-up">
        {recentSnapshots.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有项目快照</h4>
            <p>建议在故事骨架稳定后先保存一个基线快照，后续自动分镜、真实 Provider 联调和交付前都能快速回滚。</p>
          </div>
        ) : (
          recentSnapshots.map((snapshot) => (
            <div key={snapshot.snapshotId} className="asset-tile">
              <span className="label">{formatDateTime(snapshot.createdAt)}</span>
              <h4>{snapshot.label}</h4>
              <p>{snapshot.project.premise || '该快照未记录额外故事前提。'}</p>
              <div className="meta-list">
                <span>阶段：{getProjectStageLabel(snapshot.project.stage)}</span>
                <span>章节：{snapshot.stats.chapters}</span>
                <span>分场：{snapshot.stats.scenes}</span>
                <span>镜头：{snapshot.stats.shots}</span>
                <span>参考：{snapshot.stats.references}</span>
                <span>渲染：{snapshot.stats.renderJobs}</span>
                <span>关键配置：{snapshot.stats.outlines}</span>
              </div>
              <ProjectSnapshotRestoreButton
                projectId={project.id}
                snapshotId={snapshot.snapshotId}
                snapshotLabel={snapshot.label}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
