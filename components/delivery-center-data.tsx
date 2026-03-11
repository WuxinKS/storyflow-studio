import Link from 'next/link';
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
      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">交付概览</span>
          <h4>{projectId ? '当前项目交付历史' : '全局交付历史'}</h4>
          <p>当前共收集到 {data.summary.total} 份交付包，可直接回看 bundle、payload、媒体索引与 zip 归档。</p>
        </div>
        <div className="asset-tile">
          <span className="label">最近导出</span>
          <h4>{formatDateTime(data.summary.latestExportAt)}</h4>
          <p>Provider 载荷：图像 {data.summary.totalProviderPayloads.image} / 语音 {data.summary.totalProviderPayloads.voice} / 视频 {data.summary.totalProviderPayloads.video}</p>
        </div>
        <div className="asset-tile">
          <span className="label">媒体沉淀</span>
          <h4>图片 {data.summary.totalMedia.images} / 音频 {data.summary.totalMedia.audio} / 视频 {data.summary.totalMedia.videos}</h4>
          <p>累计媒体总数 {data.summary.totalMedia.total}，其中 mock {data.summary.totalMedia.mock} 条、remote {data.summary.totalMedia.remote} 条。</p>
        </div>
      </div>

      <div className="asset-grid">
        {data.bundles.map((bundle) => (
          <div key={`${bundle.bundleName}-${bundle.exportedAt}`} className="asset-tile scene-tile">
            <span className="label">交付包</span>
            <h4>{bundle.projectTitle}</h4>
            <p><strong>导出时间：</strong>{formatDateTime(bundle.exportedAt)}</p>
            <p><strong>目录：</strong>{bundle.bundleDir}</p>
            <p><strong>视觉风格：</strong>{bundle.styleName || '未写入视觉风格'}</p>
            <p><strong>角色摘要：</strong>{bundle.characterSummary || '未写入角色摘要'}</p>
            {bundle.providerProfiles.length > 0 ? (
              <div className="tag-list">
                {bundle.providerProfiles.map((profile) => (
                  <span key={`${bundle.bundleName}-${profile.provider}`} className="tag-chip">
                    {getRenderProviderLabel(profile.provider)}：{profile.providerName || '未命名'} / {profile.providerModel || '未指定模型'}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="meta-list">
              <span>图像载荷：{bundle.providerCounts.image}</span>
              <span>语音载荷：{bundle.providerCounts.voice}</span>
              <span>视频载荷：{bundle.providerCounts.video}</span>
              <span>媒体：{bundle.mediaCounts.total}</span>
              <span>bundle：{formatBytes(bundle.sizes.bundleBytes)}</span>
              <span>zip：{formatBytes(bundle.sizes.zipBytes)}</span>
            </div>
            <div className="tag-list">
              <span className="tag-chip">图片 {bundle.mediaCounts.images}</span>
              <span className="tag-chip">音频 {bundle.mediaCounts.audio}</span>
              <span className="tag-chip">视频 {bundle.mediaCounts.videos}</span>
              <span className="tag-chip">mock {bundle.mediaCounts.mock}</span>
              <span className="tag-chip">remote {bundle.mediaCounts.remote}</span>
            </div>
            <div className="action-row wrap-row">
              <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.manifestPath)} target="_blank" rel="noreferrer">Manifest</a>
              <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.bundlePath)} target="_blank" rel="noreferrer">Production Bundle</a>
              <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.providersPath)} target="_blank" rel="noreferrer">Provider Payload</a>
              <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.generatedMediaPath)} target="_blank" rel="noreferrer">媒体索引</a>
              <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.presetsPath)} target="_blank" rel="noreferrer">Preset JSON</a>
              {bundle.files.zipPath ? (
                <a className="button-secondary" href={buildLocalMediaPreviewHref(bundle.files.zipPath)} target="_blank" rel="noreferrer">下载 Zip</a>
              ) : null}
              {bundle.projectId ? (
                <>
                  <Link href={buildProjectHref('/render-studio', bundle.projectId)} className="button-ghost">返回生成</Link>
                  <Link href={buildProjectHref('/render-runs', bundle.projectId)} className="button-ghost">运行诊断</Link>
                  <Link href={buildProjectHref('/qa-panel', bundle.projectId)} className="button-ghost">查看 QA</Link>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
