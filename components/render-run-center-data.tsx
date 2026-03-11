import Link from 'next/link';
import { getRenderRunCenterData } from '@/features/delivery/service';
import {
  getRenderExecutionModeLabel,
  getRenderJobStatusLabel,
  getRenderProviderLabel,
} from '@/lib/display';
import { buildLocalMediaPreviewHref } from '@/lib/media-preview';
import { buildProjectHref } from '@/lib/project-links';

function formatDateTime(value: string | null) {
  if (!value) return '暂无记录';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) return '未写入';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export async function RenderRunCenterData({
  projectId,
  limit = 12,
}: {
  projectId?: string;
  limit?: number;
}) {
  const data = await getRenderRunCenterData(projectId, limit).catch(() => null);

  if (!data || data.runs.length === 0) {
    return (
      <div className="asset-grid">
        <div className="asset-tile">
          <span className="label">空状态</span>
          <h4>还没有渲染运行工件</h4>
          <p>先去生成工作台执行渲染任务，系统会把每次 Provider 的请求 JSON、响应 JSON 和媒体索引都写进 `exports/render-runs/`。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">运行总览</span>
          <h4>{projectId ? '当前项目运行历史' : '全局运行历史'}</h4>
          <p>当前已收集 {data.summary.total} 次运行，覆盖 {data.summary.providerCount} 个 Provider 执行记录。</p>
        </div>
        <div className="asset-tile">
          <span className="label">最近一次</span>
          <h4>{formatDateTime(data.summary.latestRunAt)}</h4>
          <p>真实执行 {data.summary.remoteProviders} 次 / 模拟执行 {data.summary.mockProviders} 次。</p>
        </div>
        <div className="asset-tile">
          <span className="label">参考透视</span>
          <h4>带参考载荷 {data.summary.totalReferenceItems}</h4>
          <p>其中定向参考 {data.summary.totalBoundItems} 项，参考源命中 {data.summary.totalSourceMedia} 次。</p>
        </div>
      </div>

      {data.runs.map((run) => (
        <div key={run.runName} className="page-stack">
          <div className="snapshot-card">
            <p className="eyebrow">渲染运行</p>
            <h3>{run.projectTitle}</h3>
            <p>目录：{run.runDir}</p>
            <div className="meta-list">
              <span>时间：{formatDateTime(run.createdAt)}</span>
              <span>Provider：{run.summary.providerCount}</span>
              <span>载荷项：{run.summary.totalPayloadItems}</span>
              <span>场次：{run.summary.totalSceneItems}</span>
              <span>镜头：{run.summary.totalShotItems}</span>
              <span>带参考：{run.summary.totalReferenceItems}</span>
              <span>定向参考：{run.summary.totalBoundItems}</span>
              <span>产物：{run.summary.assetCount}</span>
            </div>
            <div className="action-row wrap-row">
              {run.projectId ? <Link href={buildProjectHref('/render-studio', run.projectId)} className="button-secondary">返回生成</Link> : null}
              {run.projectId ? <Link href={buildProjectHref('/reference-lab', run.projectId)} className="button-ghost">查看参考绑定</Link> : null}
              {run.projectId ? <Link href={buildProjectHref('/qa-panel', run.projectId)} className="button-ghost">查看 QA</Link> : null}
              {run.projectId ? <Link href={buildProjectHref('/delivery-center', run.projectId)} className="button-ghost">查看交付</Link> : null}
            </div>
          </div>

          <div className="asset-grid three-up">
            {run.providers.map((provider) => (
              <div key={`${run.runName}-${provider.provider}`} className="asset-tile scene-tile">
                <span className="label">{getRenderExecutionModeLabel(provider.mode)}</span>
                <h4>{getRenderProviderLabel(provider.provider)}</h4>
                <p>{provider.message || provider.responsePreview || '已记录请求与响应工件，可直接打开排查。'}</p>
                <div className="meta-list">
                  <span>载荷项：{provider.payloadCount}</span>
                  <span>场次：{provider.sceneCount}</span>
                  <span>镜头：{provider.shotCount}</span>
                  <span>带参考：{provider.referencePayloadCount}</span>
                  <span>定向参考：{provider.boundPayloadCount}</span>
                  <span>参考源：{provider.sourceMediaCount}</span>
                  <span>响应项：{provider.itemCount ?? 0}</span>
                </div>
                {provider.referenceTitles.length > 0 ? (
                  <div className="tag-list">
                    {provider.referenceTitles.map((title) => (
                      <span key={`${provider.provider}-${title}`} className="tag-chip">{title}</span>
                    ))}
                  </div>
                ) : null}
                {provider.matchedJob ? (
                  <>
                    <p><strong>任务状态：</strong>{getRenderJobStatusLabel(provider.matchedJob.status)}</p>
                    <p><strong>执行时间：</strong>{formatDateTime(provider.matchedJob.executedAt)}</p>
                    <p><strong>重试次数：</strong>{provider.matchedJob.retryCount} / <strong>产物数：</strong>{provider.matchedJob.assetCount}</p>
                    {provider.matchedJob.endpoint ? <p><strong>Endpoint：</strong>{provider.matchedJob.endpoint}</p> : null}
                    {provider.matchedJob.lastError ? <p><strong>错误：</strong>{provider.matchedJob.lastError}</p> : null}
                  </>
                ) : null}
                <div className="meta-list">
                  <span>Request：{formatBytes(provider.sizes.requestBytes)}</span>
                  <span>Response：{formatBytes(provider.sizes.responseBytes)}</span>
                  <span>写盘时间：{formatDateTime(provider.generatedAt)}</span>
                </div>
                <div className="action-row wrap-row">
                  {provider.requestPath ? (
                    <a className="button-ghost" href={buildLocalMediaPreviewHref(provider.requestPath)} target="_blank" rel="noreferrer">请求 JSON</a>
                  ) : null}
                  {provider.responsePath ? (
                    <a className="button-ghost" href={buildLocalMediaPreviewHref(provider.responsePath)} target="_blank" rel="noreferrer">响应 JSON</a>
                  ) : null}
                  {provider.matchedJob?.artifactIndexPath ? (
                    <a className="button-ghost" href={buildLocalMediaPreviewHref(provider.matchedJob.artifactIndexPath)} target="_blank" rel="noreferrer">媒体索引</a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
