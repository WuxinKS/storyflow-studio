import Link from 'next/link';
import { DeliveryExportButton } from '@/components/delivery-export-button';
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

function getBundleStateLabel(bundle: {
  readyForFullVideo: boolean;
  readyForAssembly: boolean;
}) {
  if (bundle.readyForFullVideo) return '完整交付包';
  if (bundle.readyForAssembly) return '可预演归档';
  return '仍需补齐';
}

type DeliveryMission =
  | {
      status: string;
      title: string;
      guidance: string;
      kind: 'generate';
    }
  | {
      status: string;
      title: string;
      guidance: string;
      kind: 'link';
      actionHref: string;
      actionLabel: string;
    };

function getDeliveryMission(input: {
  projectId?: string;
  latestBundle?: {
    readyForFullVideo: boolean;
    readyForAssembly: boolean;
    files: { zipPath: string | null };
  };
}): DeliveryMission {
  if (!input.projectId) {
    return input.latestBundle?.files.zipPath
      ? {
          status: '查看最近交付包',
          title: '打开最新 Zip',
          kind: 'link' as const,
          actionHref: buildLocalMediaPreviewHref(input.latestBundle.files.zipPath),
          actionLabel: '打开最新 Zip',
          guidance: '当前处于全局交付视角，先看最近一份交付包最直接。',
        }
      : {
          status: '等待交付包',
          title: '先去生成工作台导出',
          kind: 'link' as const,
          actionHref: '/render-studio',
          actionLabel: '前往生成工作台',
          guidance: '还没有可用交付包时，先回主流程继续生成和装配。',
        };
  }

  if (!input.latestBundle) {
    return {
      status: '待生成首份交付包',
      title: '生成首份交付包',
      kind: 'generate' as const,
      guidance: '当成片已经跑到这里，这一步只做一件事：把当前成果归档成可追溯的交付包。',
    };
  }

  if (!input.latestBundle.readyForAssembly) {
    return {
      status: '交付前仍有缺口',
      title: '先回成片预演补齐',
      kind: 'link' as const,
      actionHref: buildProjectHref('/final-cut', input.projectId),
      actionLabel: '回到成片预演',
      guidance: '当前这份交付包仍有缺口，先在 final cut 把阻塞项清掉，再重新导出会更稳。',
    };
  }

  if (input.latestBundle.readyForFullVideo && input.latestBundle.files.zipPath) {
    return {
      status: '最新交付包可直接使用',
      title: '打开最新 Zip',
      kind: 'link' as const,
      actionHref: buildLocalMediaPreviewHref(input.latestBundle.files.zipPath),
      actionLabel: '打开最新 Zip',
      guidance: '当前已经有一份完整交付包，可以直接打开或下载，同时也能按需重新导出。',
    };
  }

  return {
    status: '建议重新导出',
    title: '重新导出当前交付包',
    kind: 'generate' as const,
    guidance: '素材链已经能预演，重新导出可以把最新 manifest、payload 和装配包统一归档。',
  };
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
      <div className="page-stack">
        <div className="asset-grid">
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有交付包</h4>
            <p>交付中心现在只负责收最后结果。先导出第一份包，后面这里才会出现可追溯档案。</p>
            {projectId ? (
              <DeliveryExportButton projectId={projectId} mode="create" />
            ) : (
              <div className="action-row wrap-row">
                <Link href="/render-studio" className="button-primary">前往生成工作台</Link>
              </div>
            )}
          </div>
        </div>

        <div className="action-row wrap-row">
          {projectId ? <Link href={buildProjectHref('/final-cut', projectId)} className="button-ghost">返回成片预演</Link> : null}
          {projectId ? <Link href={buildProjectHref('/render-studio', projectId)} className="button-secondary">返回生成工作台</Link> : null}
        </div>
      </div>
    );
  }

  const latestBundle = data.bundles[0];
  const deliveryMission = getDeliveryMission({
    projectId,
    latestBundle,
  });
  const deliveryLinkHref = deliveryMission.kind === 'link' ? deliveryMission.actionHref : null;
  const deliveryLinkExternal = deliveryLinkHref
    ? deliveryLinkHref.startsWith('/api/') || deliveryLinkHref.endsWith('.zip')
    : false;

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

          <div className="asset-tile delivery-focus-card">
            <span className="label">当前主任务</span>
            <h4>{deliveryMission.title}</h4>
            <p>{deliveryMission.guidance}</p>
            {deliveryMission.kind === 'generate' ? (
              projectId ? <DeliveryExportButton projectId={projectId} mode={latestBundle ? 'refresh' : 'create'} /> : null
            ) : (
              <div className="page-stack">
                <div className="action-row wrap-row">
                  <a
                    href={deliveryLinkHref ?? '#'}
                    className="button-primary"
                    target={deliveryLinkExternal ? '_blank' : undefined}
                    rel={deliveryLinkExternal ? 'noreferrer' : undefined}
                  >
                    {deliveryMission.actionLabel}
                  </a>
                </div>
                {projectId ? (
                  <details className="workflow-disclosure">
                    <summary>需要时重新导出</summary>
                    <div className="workflow-disclosure-body">
                      <DeliveryExportButton projectId={projectId} mode="refresh" />
                    </div>
                  </details>
                ) : null}
              </div>
            )}
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

            <div className="asset-tile ops-kpi-card">
              <span className="label">最新状态</span>
              <h4>{getBundleStateLabel(latestBundle)}</h4>
              <p>{latestBundle.readyForFullVideo ? '最新一份交付包已经是完整视频版。' : latestBundle.readyForAssembly ? '最新一份交付包可用于预演归档。' : '最新一份交付包仍需补齐素材后再导出。'} </p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Current Bundle"
        title="优先看最新一份交付包"
        description="默认先确认最新交付包是否能直接用，历史版本放到下面按需展开。"
      >
        <div className="ops-run-stack">
          <article key={`${latestBundle.bundleName}-${latestBundle.exportedAt}`} className="snapshot-card ops-run-card">
            <div className="ops-command-head">
              <div>
                <p className="eyebrow">最新交付包</p>
                <h3>{latestBundle.projectTitle}</h3>
              </div>
              <span className="status-pill status-pill-subtle">{getBundleStateLabel(latestBundle)}</span>
            </div>

            <p><strong>导出时间：</strong>{formatDateTime(latestBundle.exportedAt)}</p>
            <p><strong>目录：</strong>{latestBundle.bundleDir}</p>
            <p><strong>视觉风格：</strong>{latestBundle.styleName || '未写入视觉风格'} / <strong>角色摘要：</strong>{latestBundle.characterSummary || '未写入角色摘要'}</p>

            <div className="meta-list">
              <span>图像载荷 {latestBundle.providerCounts.image}</span>
              <span>语音载荷 {latestBundle.providerCounts.voice}</span>
              <span>视频载荷 {latestBundle.providerCounts.video}</span>
              <span>媒体 {latestBundle.mediaCounts.total}</span>
              <span>装配 {latestBundle.assemblyState || '未标记'}</span>
              <span>预演成片 {latestBundle.files.finalCutPreviewPath ? 'ready' : 'not-yet'}</span>
              <span>bundle {formatBytes(latestBundle.sizes.bundleBytes)}</span>
              <span>zip {formatBytes(latestBundle.sizes.zipBytes)}</span>
            </div>

            {latestBundle.providerProfiles.length > 0 ? (
              <div className="tag-list">
                {latestBundle.providerProfiles.map((profile) => (
                  <span key={`${latestBundle.bundleName}-${profile.provider}`} className="tag-chip">
                    {getRenderProviderLabel(profile.provider)}：{profile.providerName || '未命名'} / {profile.providerModel || '未指定模型'}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="action-row wrap-row">
              {latestBundle.files.zipPath ? (
                <a className="button-primary" href={buildLocalMediaPreviewHref(latestBundle.files.zipPath)} target="_blank" rel="noreferrer">打开 Zip</a>
              ) : null}
              {latestBundle.files.finalCutPreviewPath ? (
                <a className="button-secondary" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPreviewPath)} target="_blank" rel="noreferrer">打开预演成片</a>
              ) : null}
              <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.manifestPath)} target="_blank" rel="noreferrer">Manifest</a>
              <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.bundlePath)} target="_blank" rel="noreferrer">Production Bundle</a>
              <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.providersPath)} target="_blank" rel="noreferrer">Provider Payload</a>
              <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPath)} target="_blank" rel="noreferrer">Final Cut JSON</a>
            </div>
          </article>
        </div>
      </SectionCard>

      {data.bundles.length > 1 ? (
        <SectionCard
          eyebrow="History"
          title="历史交付包"
          description="需要追历史版本时再展开，避免默认把整页变成档案仓库。"
        >
          <details className="workflow-disclosure">
            <summary>展开其余 {data.bundles.length - 1} 份交付包</summary>
            <div className="workflow-disclosure-body">
              <div className="ops-run-stack">
                {data.bundles.slice(1).map((bundle) => (
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

                    <div className="action-row wrap-row">
                      <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.manifestPath)} target="_blank" rel="noreferrer">Manifest</a>
                      <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.bundlePath)} target="_blank" rel="noreferrer">Production Bundle</a>
                      <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.providersPath)} target="_blank" rel="noreferrer">Provider Payload</a>
                      <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.generatedMediaPath)} target="_blank" rel="noreferrer">媒体索引</a>
                      <a className="button-ghost" href={buildLocalMediaPreviewHref(bundle.files.finalCutPath)} target="_blank" rel="noreferrer">Final Cut JSON</a>
                      {bundle.files.zipPath ? (
                        <a className="button-secondary" href={buildLocalMediaPreviewHref(bundle.files.zipPath)} target="_blank" rel="noreferrer">打开 Zip</a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </details>
        </SectionCard>
      ) : null}

      <SectionCard
        eyebrow="Full Archive"
        title="完整工件入口"
        description="只有在要追具体文件时，再使用下面这些完整入口和回跳动作。"
      >
        <details className="workflow-disclosure">
          <summary>展开最新交付包的全部工件入口</summary>
          <div className="workflow-disclosure-body">
            <article className="snapshot-card ops-run-card">
              <div className="ops-command-head">
                <div>
                  <p className="eyebrow">交付包</p>
                  <h3>{latestBundle.projectTitle}</h3>
                </div>
                <span className="status-pill status-pill-subtle">{formatDateTime(latestBundle.exportedAt)}</span>
              </div>

              <p><strong>目录：</strong>{latestBundle.bundleDir}</p>
              <p><strong>视觉风格：</strong>{latestBundle.styleName || '未写入视觉风格'} / <strong>角色摘要：</strong>{latestBundle.characterSummary || '未写入角色摘要'}</p>

              <div className="meta-list">
                <span>图像载荷 {latestBundle.providerCounts.image}</span>
                <span>语音载荷 {latestBundle.providerCounts.voice}</span>
                <span>视频载荷 {latestBundle.providerCounts.video}</span>
                <span>媒体 {latestBundle.mediaCounts.total}</span>
                <span>装配 {latestBundle.assemblyState || '未标记'}</span>
                <span>预演成片 {latestBundle.files.finalCutPreviewPath ? 'ready' : 'not-yet'}</span>
                <span>bundle {formatBytes(latestBundle.sizes.bundleBytes)}</span>
                <span>zip {formatBytes(latestBundle.sizes.zipBytes)}</span>
              </div>

              {latestBundle.providerProfiles.length > 0 ? (
                <div className="tag-list">
                  {latestBundle.providerProfiles.map((profile) => (
                    <span key={`${latestBundle.bundleName}-${profile.provider}`} className="tag-chip">
                      {getRenderProviderLabel(profile.provider)}：{profile.providerName || '未命名'} / {profile.providerModel || '未指定模型'}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="tag-list">
                <span className="tag-chip">图片 {latestBundle.mediaCounts.images}</span>
                <span className="tag-chip">音频 {latestBundle.mediaCounts.audio}</span>
                <span className="tag-chip">视频 {latestBundle.mediaCounts.videos}</span>
                <span className="tag-chip">mock {latestBundle.mediaCounts.mock}</span>
                <span className="tag-chip">remote {latestBundle.mediaCounts.remote}</span>
                <span className="tag-chip">预演 {latestBundle.readyForAssembly ? 'ready' : 'blocked'}</span>
                <span className="tag-chip">全视频 {latestBundle.readyForFullVideo ? 'ready' : 'not-yet'}</span>
              </div>

              <div className="action-row wrap-row">
                <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.manifestPath)} target="_blank" rel="noreferrer">Manifest</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.bundlePath)} target="_blank" rel="noreferrer">Production Bundle</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.providersPath)} target="_blank" rel="noreferrer">Provider Payload</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.generatedMediaPath)} target="_blank" rel="noreferrer">媒体索引</a>
                <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPath)} target="_blank" rel="noreferrer">Final Cut JSON</a>
                {latestBundle.files.finalCutAssemblyPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutAssemblyPath)} target="_blank" rel="noreferrer">装配包 JSON</a>
                ) : null}
                {latestBundle.files.finalCutSegmentsPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutSegmentsPath)} target="_blank" rel="noreferrer">镜头段清单</a>
                ) : null}
                {latestBundle.files.finalCutAudioSegmentsPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutAudioSegmentsPath)} target="_blank" rel="noreferrer">音轨段清单</a>
                ) : null}
                {latestBundle.files.finalCutScriptPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutScriptPath)} target="_blank" rel="noreferrer">装配脚本</a>
                ) : null}
                {latestBundle.files.finalCutPreviewPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPreviewPath)} target="_blank" rel="noreferrer">预演成片</a>
                ) : null}
                {latestBundle.files.finalCutPreviewVisualPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPreviewVisualPath)} target="_blank" rel="noreferrer">预演视频轨</a>
                ) : null}
                {latestBundle.files.finalCutPreviewAudioPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPreviewAudioPath)} target="_blank" rel="noreferrer">预演音轨</a>
                ) : null}
                {latestBundle.files.finalCutPreviewLogPath ? (
                  <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.finalCutPreviewLogPath)} target="_blank" rel="noreferrer">拼装日志</a>
                ) : null}
                <a className="button-ghost" href={buildLocalMediaPreviewHref(latestBundle.files.presetsPath)} target="_blank" rel="noreferrer">Preset JSON</a>
                {latestBundle.files.zipPath ? (
                  <a className="button-secondary" href={buildLocalMediaPreviewHref(latestBundle.files.zipPath)} target="_blank" rel="noreferrer">下载 Zip</a>
                ) : null}
                {latestBundle.projectId ? (
                  <>
                    <a
                      className="button-ghost"
                      href={`/api/render?action=assemble-final-cut-preview&projectId=${latestBundle.projectId}&open=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      一键拼装成片
                    </a>
                    <Link href={buildProjectHref('/render-studio', latestBundle.projectId)} className="button-ghost">返回生成</Link>
                    <Link href={buildProjectHref('/final-cut', latestBundle.projectId)} className="button-ghost">成片预演</Link>
                    <Link href={buildProjectHref('/render-runs', latestBundle.projectId)} className="button-ghost">运行诊断</Link>
                    <Link href={buildProjectHref('/qa-panel', latestBundle.projectId)} className="button-ghost">查看 QA</Link>
                  </>
                ) : null}
              </div>
            </article>
          </div>
        </details>
      </SectionCard>
    </div>
  );
}
