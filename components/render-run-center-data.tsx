import Link from 'next/link';
import { SectionCard } from '@/components/section-card';
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
      <div className="ops-command-grid">
        <section className="snapshot-card ops-command-card">
          <div className="ops-command-head">
            <div>
              <p className="eyebrow">Run Diagnostics</p>
              <h3>{projectId ? '当前项目运行历史' : '全局运行历史'}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{data.summary.total} 次运行</span>
          </div>

          <p>
            这里把每次图像、语音、视频 Provider 的请求工件、响应工件和参考注入都串起来，
            排查问题时可以直接跳到某一次运行、某一个 Provider，而不是在日志目录里手动翻文件。
          </p>

          <div className="meta-list">
            <span>最近一次 {formatDateTime(data.summary.latestRunAt)}</span>
            <span>Provider 种类 {data.summary.providerCount}</span>
            <span>真实执行 {data.summary.remoteProviders}</span>
            <span>模拟执行 {data.summary.mockProviders}</span>
            <span>参考载荷 {data.summary.totalReferenceItems}</span>
            <span>定向参考 {data.summary.totalBoundItems}</span>
          </div>
        </section>

        <aside className="ops-command-side">
          <div className="ops-kpi-grid">
            <div className="asset-tile ops-kpi-card">
              <span className="label">运行总数</span>
              <h4>{data.summary.total}</h4>
              <p>当前已沉淀 {data.summary.total} 次运行目录，可直接回看工件。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">参考命中</span>
              <h4>{data.summary.totalReferenceItems}</h4>
              <p>其中定向参考 {data.summary.totalBoundItems} 项，参考源命中 {data.summary.totalSourceMedia} 次。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">真实执行</span>
              <h4>{data.summary.remoteProviders}</h4>
              <p>真实执行 {data.summary.remoteProviders} 次，模拟执行 {data.summary.mockProviders} 次。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">覆盖 Provider</span>
              <h4>{data.summary.providerCount}</h4>
              <p>当前运行历史覆盖了 {data.summary.providerCount} 个 Provider 类型。</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Runs"
        title="运行工件时间线"
        description="按次查看运行目录，每一条都带项目上下文、Provider 执行卡和工件直达入口。"
      >
        <div className="ops-run-stack">
          {data.runs.map((run) => (
            <article key={run.runName} className="snapshot-card ops-run-card">
              <div className="ops-command-head">
                <div>
                  <p className="eyebrow">渲染运行</p>
                  <h3>{run.projectTitle}</h3>
                </div>
                <span className="status-pill status-pill-subtle">{formatDateTime(run.createdAt)}</span>
              </div>

              <p>目录：{run.runDir}</p>

              <div className="meta-list">
                <span>Provider {run.summary.providerCount}</span>
                <span>载荷项 {run.summary.totalPayloadItems}</span>
                <span>场次 {run.summary.totalSceneItems}</span>
                <span>镜头 {run.summary.totalShotItems}</span>
                <span>带参考 {run.summary.totalReferenceItems}</span>
                <span>定向参考 {run.summary.totalBoundItems}</span>
                <span>产物 {run.summary.assetCount}</span>
              </div>

              <div className="action-row wrap-row">
                {run.projectId ? <Link href={buildProjectHref('/render-studio', run.projectId)} className="button-secondary">返回生成</Link> : null}
                {run.projectId ? <Link href={buildProjectHref('/reference-lab', run.projectId)} className="button-ghost">查看参考绑定</Link> : null}
                {run.projectId ? <Link href={buildProjectHref('/qa-panel', run.projectId)} className="button-ghost">查看 QA</Link> : null}
                {run.projectId ? <Link href={buildProjectHref('/delivery-center', run.projectId)} className="button-ghost">查看交付</Link> : null}
              </div>

              <div className="ops-provider-grid">
                {run.providers.map((provider) => (
                  <div key={`${run.runName}-${provider.provider}`} className="asset-tile ops-provider-card">
                    <div className="ops-provider-head">
                      <div>
                        <span className="label">{getRenderExecutionModeLabel(provider.mode)}</span>
                        <h4>{getRenderProviderLabel(provider.provider)}</h4>
                      </div>
                      <span className="status-pill status-pill-subtle">{provider.matchedJob ? getRenderJobStatusLabel(provider.matchedJob.status) : '仅工件记录'}</span>
                    </div>

                    <p>{provider.message || provider.responsePreview || '已记录请求与响应工件，可直接打开排查。'}</p>

                    <div className="meta-list">
                      <span>供应商 {provider.providerName || provider.matchedJob?.providerName || '未记录'}</span>
                      <span>模型 {provider.providerModel || provider.matchedJob?.providerModel || '未记录'}</span>
                      <span>适配 {provider.matchedJob?.adapter || '未记录'}</span>
                      <span>载荷 {provider.payloadCount}</span>
                      <span>场次 {provider.sceneCount}</span>
                      <span>镜头 {provider.shotCount}</span>
                      <span>参考 {provider.referencePayloadCount}</span>
                      <span>定向 {provider.boundPayloadCount}</span>
                      <span>源媒体 {provider.sourceMediaCount}</span>
                      <span>响应项 {provider.itemCount ?? 0}</span>
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
                        <p><strong>执行时间：</strong>{formatDateTime(provider.matchedJob.executedAt)}</p>
                        <p><strong>重试次数：</strong>{provider.matchedJob.retryCount} / <strong>产物数：</strong>{provider.matchedJob.assetCount}</p>
                        {provider.matchedJob.endpoint ? <p><strong>Endpoint：</strong>{provider.matchedJob.endpoint}</p> : null}
                        {provider.matchedJob.taskStatus ? <p><strong>任务状态：</strong>{provider.matchedJob.taskStatus}</p> : null}
                        {provider.matchedJob.pollAttempts > 0 ? <p><strong>轮询次数：</strong>{provider.matchedJob.pollAttempts}</p> : null}
                        {provider.matchedJob.pendingTasks > 0 ? <p><strong>待推进任务：</strong>{provider.matchedJob.pendingTasks}</p> : null}
                        {provider.matchedJob.pollPath ? <p><strong>回查路径：</strong>{provider.matchedJob.pollPath}</p> : null}
                        {provider.matchedJob.lastError ? <p><strong>错误：</strong>{provider.matchedJob.lastError}</p> : null}
                      </>
                    ) : null}

                    <div className="meta-list">
                      <span>Request {formatBytes(provider.sizes.requestBytes)}</span>
                      <span>Response {formatBytes(provider.sizes.responseBytes)}</span>
                      <span>写盘时间 {formatDateTime(provider.generatedAt)}</span>
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
                      {provider.matchedJob?.pollTracePath ? (
                        <a className="button-ghost" href={buildLocalMediaPreviewHref(provider.matchedJob.pollTracePath)} target="_blank" rel="noreferrer">轮询工件</a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
