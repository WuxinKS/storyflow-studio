import Link from 'next/link';
import { SectionCard } from '@/components/section-card';
import { getDeliveryCenterData } from '@/features/delivery/service';
import { buildLocalMediaPreviewHref } from '@/lib/media-preview';
import { buildProjectHref } from '@/lib/project-links';
import { getRenderProviderLabel } from '@/lib/display';

function formatDateTime(value: string | null) {
  if (!value) return '暂无导出记录';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) return '未生成';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export async function DeliveryCenterData({
  projectId,
  limit = 12,
}: {
  projectId?: string;
  limit?: number;
}) {
  const data = await getDeliveryCenterData(projectId, limit).catch(() => null);

  if (!data || data.bundles.length === 0) {
    return (
      <div className="asset-grid">
        <div className="asset-tile">
          <span className="label">空状态</span>
          <h4>还没有交付包</h4>
          <p>先去生成工作台执行导出包，交付中心会自动收集 manifest、provider payload、媒体索引和 zip 归档。</p>
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
              <p className="eyebrow">Delivery Command</p>
              <h3>{projectId ? '当前项目交付历史' : '全局交付历史'}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{data.summary.total} 份交付包</span>
          </div>

          <p>
            这里是最后的交付档案库：每个 bundle 都串好了 manifest、Provider payload、媒体索引、装配文件和 zip，
            方便我们快速确认“这一版到底是怎么产出来的”。
          </p>

          <div className="meta-list">
            <span>最近导出 {formatDateTime(data.summary.latestExportAt)}</span>
            <span>图片载荷 {data.summary.totalProviderPayloads.image}</span>
            <span>语音载荷 {data.summary.totalProviderPayloads.voice}</span>
            <span>视频载荷 {data.summary.totalProviderPayloads.video}</span>
            <span>总媒体 {data.summary.totalMedia.total}</span>
          </div>
        </section>

        <aside className="ops-command-side">
          <div className="ops-kpi-grid">
            <div className="asset-tile ops-kpi-card">
              <span className="label">媒体沉淀</span>
              <h4>{data.summary.totalMedia.total}</h4>
              <p>图片 {data.summary.totalMedia.images} / 音频 {data.summary.totalMedia.audio} / 视频 {data.summary.totalMedia.videos}</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">Mock / Remote</span>
              <h4>{data.summary.totalMedia.remote}</h4>
              <p>remote {data.summary.totalMedia.remote} 条，mock {data.summary.totalMedia.mock} 条。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">最近导出</span>
              <h4>{data.summary.latestExportAt ? '已记录' : '暂无'}</h4>
              <p>{formatDateTime(data.summary.latestExportAt)}</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">交付库规模</span>
              <h4>{data.summary.total}</h4>
              <p>当前交付中心共收集到 {data.summary.total} 份导出包。</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Bundles"
        title="交付包档案"
        description="每个交付包都带完整工件入口和回跳动作，方便回看、下载和继续修订。"
      >
        <div className="ops-run-stack">
          {data.bundles.map((bundle) => (
            <article key={`${bundle.bundleName}-${bundle.exportedAt}`} className="snapshot-card ops-run-card">
              <div className="ops-command-head">
                <div>
                  <p className="eyebrow">交付包</p>
                  <h3>{bundle.projectTitle}</h3>
                </div>
                <span className="status-pill status-pill-subtle">{formatDateTime(bundle.exportedAt)}</span>
              </div>

              <p><strong>目录：</strong>{bundle.bundleDir}</p>
              <p><strong>视觉风格：</strong>{bundle.styleName || '未写入视觉风格'} / <strong>角色摘要：</strong>{bundle.characterSummary || '未写入角色摘要'}</p>

              <div className="meta-list">
                <span>图像载荷 {bundle.providerCounts.image}</span>
                <span>语音载荷 {bundle.providerCounts.voice}</span>
                <span>视频载荷 {bundle.providerCounts.video}</span>
                <span>媒体 {bundle.mediaCounts.total}</span>
                <span>装配 {bundle.assemblyState || '未标记'}</span>
                <span>预演成片 {bundle.files.finalCutPreviewPath ? 'ready' : 'not-yet'}</span>
                <span>bundle {formatBytes(bundle.sizes.bundleBytes)}</span>
                <span>zip {formatBytes(bundle.sizes.zipBytes)}</span>
              </div>

              {bundle.providerProfiles.length > 0 ? (
                <div className="tag-list">
                  {bundle.providerProfiles.map((profile) => (
                    <span key={`${bundle.bundleName}-${profile.provider}`} className="tag-chip">
                      {getRenderProviderLabel(profile.provider)}：{profile.providerName || '未命名'} / {profile.providerModel || '未指定模型'}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="tag-list">
                <span className="tag-chip">图片 {bundle.mediaCounts.images}</span>
                <span className="tag-chip">音频 {bundle.mediaCounts.audio}</span>
                <span className="tag-chip">视频 {bundle.mediaCounts.videos}</span>
                <span className="tag-chip">mock {bundle.mediaCounts.mock}</span>
                <span className="tag-chip">remote {bundle.mediaCounts.remote}</span>
                <span className="tag-chip">预演 {bundle.readyForAssembly ? 'ready' : 'blocked'}</span>
                <span className="tag-chip">全视频 {bundle.readyForFullVideo ? 'ready' : 'not-yet'}</span>
              </div>

              <div className="action-row wrap-row">
                <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.manifestPath)} target="_blank" rel="noreferrer">Manifest</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.bundlePath)} target="_blank" rel="noreferrer">Production Bundle</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.providersPath)} target="_blank" rel="noreferrer">Provider Payload</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.generatedMediaPath)} target="_blank" rel="noreferrer">媒体索引</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutPath)} target="_blank" rel="noreferrer">Final Cut JSON</a>
                {bundle.files.finalCutAssemblyPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutAssemblyPath)} target="_blank" rel="noreferrer">装配包 JSON</a>
                ) : null}
                {bundle.files.finalCutSegmentsPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutSegmentsPath)} target="_blank" rel="noreferrer">镜头段清单</a>
                ) : null}
                {bundle.files.finalCutAudioSegmentsPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutAudioSegmentsPath)} target="_blank" rel="noreferrer">音轨段清单</a>
                ) : null}
                {bundle.files.finalCutScriptPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutScriptPath)} target="_blank" rel="noreferrer">装配脚本</a>
                ) : null}
                {bundle.files.finalCutPreviewPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutPreviewPath)} target="_blank" rel="noreferrer">预演成片</a>
                ) : null}
                {bundle.files.finalCutPreviewVisualPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutPreviewVisualPath)} target="_blank" rel="noreferrer">预演视频轨</a>
                ) : null}
                {bundle.files.finalCutPreviewAudioPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutPreviewAudioPath)} target="_blank" rel="noreferrer">预演音轨</a>
                ) : null}
                {bundle.files.finalCutPreviewLogPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutPreviewLogPath)} target="_blank" rel="noreferrer">拼装日志</a>
                ) : null}
                <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.presetsPath)} target="_blank" rel="noreferrer">Preset JSON</a>
                {bundle.files.zipPath ? (
                  <a className="button-secondary" href={buildLocalMediaPreviewHref(bundle.files.zipPath)} target="_blank" rel="noreferrer">下载 Zip</a>
                ) : null}
                {bundle.projectId ? (
                  <>
                    <a
                      className="button-ghost"
                      href={`/api/render?action=assemble-final-cut-preview&projectId=${bundle.projectId}&open=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      一键拼装成片
                    </a>
                    <Link href={buildProjectHref('/render-studio', bundle.projectId)} className="button-ghost">返回生成</Link>
                    <Link href={buildProjectHref('/final-cut', bundle.projectId)} className="button-ghost">成片预演</Link>
                    <Link href={buildProjectHref('/render-runs', bundle.projectId)} className="button-ghost">运行诊断</Link>
                    <Link href={buildProjectHref('/qa-panel', bundle.projectId)} className="button-ghost">查看 QA</Link>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
