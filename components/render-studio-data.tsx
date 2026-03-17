import Link from 'next/link';
import { MediaPreview } from '@/components/media-preview';
import { RenderGenerateButton } from '@/components/render-generate-button';
import { RenderJobActionButton } from '@/components/render-job-action-button';
import { RenderPayloadPreview } from '@/components/render-payload-preview';
import { SectionCard } from '@/components/section-card';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getGeneratedMediaEntries, summarizeGeneratedMediaCounts } from '@/features/media/service';
import { buildReferenceBindingSnapshot, buildReferenceProfile } from '@/features/reference/service';
import { getRenderPresetForShot, getRenderProject, parseRenderJobOutput } from '@/features/render/service';
import { getSyncStatus } from '@/features/sync/service';
import { getTimelineBundle } from '@/features/timeline/service';
import { getVisualBibleBundle } from '@/features/visual/service';
import {
  getRenderExecutionModeLabel,
  getRenderJobStatusLabel,
  getRenderProviderLabel,
} from '@/lib/display';
import { getPreviewKindFromGeneratedType, resolvePreviewSource } from '@/lib/media-preview';
import { buildProjectHref } from '@/lib/project-links';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';

function summarizeStatus(statuses: string[]) {
  const done = statuses.filter((status) => status === 'done').length;
  const running = statuses.filter((status) => status === 'running').length;
  const queued = statuses.filter((status) => status === 'queued').length;
  const failed = statuses.filter((status) => status === 'failed').length;
  return { done, running, queued, failed };
}

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function hasReferenceFlavor(text: string | null) {
  if (!text) return false;
  return text.includes('参考构图') || text.includes('情绪参考') || text.includes('动作节奏参考');
}

function hasDirectorLanguage(text: string | null) {
  if (!text) return false;
  return text.includes('导演处理上强调') || text.includes('镜头重点放在');
}

function getRenderStrategy(kind: string) {
  const strategyMap: Record<string, { visual: string; motion: string; useCase: string }> = {
    空间建立: {
      visual: '广角环境 / 多层景别 / 强调空间关系',
      motion: '缓慢推进 / 平稳摇镜 / 稳定开场',
      useCase: '适合先建立空间关系、场域压迫感与人物位置。',
    },
    细节观察: {
      visual: '微距特写 / 强调材质与细节',
      motion: '轻微位移 / 拉焦 / 细节导向构图',
      useCase: '适合拍线索、物件、手部动作、微表情与察觉过程。',
    },
    感官压迫: {
      visual: '紧绷构图 / 闪烁对比 / 强纹理压迫',
      motion: '声音驱动紧张 / 轻微抖动 / 压迫累积',
      useCase: '适合警示灯、异响、液体、气压变化等生理不安场景。',
    },
    情绪落点: {
      visual: '近景特写 / 表演停留 / 情绪孤立',
      motion: '静止停留 / 缓慢呼吸节奏 / 极简运动',
      useCase: '适合停顿、呼吸、表情收束和情绪余波。',
    },
    关系压迫: {
      visual: '越肩构图 / 压缩距离 / 对抗视线',
      motion: '推进式张力 / 锁定式对峙构图',
      useCase: '适合对峙、权力关系、距离压迫与视线博弈。',
    },
    动作触发: {
      visual: '方向性构图 / 动作优先画面',
      motion: '动作强调 / 动态重构图 / 加速提示',
      useCase: '适合动作起点、决策瞬间、冲突触发和节奏切换。',
    },
    对白博弈: {
      visual: '正反打 / 越肩视角 / 强调反应镜头',
      motion: '停顿-回应节奏 / 可控切换速度',
      useCase: '适合对白压力、反应镜头与台词权力结构。',
    },
  };

  return strategyMap[kind] || {
    visual: '平衡的电影式构图',
    motion: '中等强度镜头运动',
    useCase: '适合作为通用镜头策略 fallback。',
  };
}

function getGeneratedMediaTypeLabel(type: string) {
  if (type === 'generated-image') return '生成图片';
  if (type === 'generated-audio') return '生成音频';
  if (type === 'generated-video') return '生成视频';
  return '生成产物';
}

function getReadinessCopy(input: {
  finalPreviewReady: boolean;
  failedCount: number;
  runningCount: number;
  readyShotRate: number;
  renderReadyShots: number;
  shotCount: number;
}) {
  if (input.finalPreviewReady) {
    return {
      title: '已经能继续推进成片',
      description: '视频产物已经进入媒体索引，当前最重要的是确认剩余镜头质量，并准备进入成片预演。',
    };
  }

  if (input.failedCount > 0) {
    return {
      title: '先清失败项',
      description: '当前已有任务失败，建议先处理错误任务，再继续拉高视频覆盖率。',
    };
  }

  if (input.runningCount > 0) {
    return {
      title: '任务正在推进',
      description: '当前工作台处于执行态，重点是盯住运行中任务和最新沉淀的媒体结果。',
    };
  }

  if (input.renderReadyShots > 0) {
    return {
      title: '已有可执行镜头',
      description: `当前已有 ${input.renderReadyShots} / ${input.shotCount} 个镜头满足生成前置条件，可直接发起新一轮执行。`,
    };
  }

  return {
    title: `${input.readyShotRate}% 镜头完成就绪检查`,
    description: '先把参考增强、镜头语言和时间线约束补齐，再执行渲染会更稳。',
  };
}

export async function RenderStudioData({ projectId }: { projectId?: string }) {
  const project = await getRenderProject(projectId).catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无渲染项目</h4>
        <p>先完成分镜数据，再创建渲染任务。</p>
      </div>
    );
  }

  const summary = summarizeStatus(project.renderJobs.map((job) => job.status));
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const referenceProfile = buildReferenceProfile(project.references || []);
  const referenceBindings = buildReferenceBindingSnapshot(project);
  const generatedMedia = getGeneratedMediaEntries(project);
  const timeline = await getTimelineBundle(project.id).catch(() => null);
  const mediaCounts = summarizeGeneratedMediaCounts(generatedMedia);
  const jobOutputs = project.renderJobs.map((job) => ({
    job,
    meta: parseRenderJobOutput(job.outputUrl),
  }));
  const finalPreviewReady = generatedMedia.some((item) => item.type === 'generated-video');
  const flavoredCount = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyCount = project.scenes.filter((scene) => hasDirectorLanguage(scene.summary)).length;
  const shotKinds = Array.from(new Set(project.shots.map((shot) => getShotKindFromTitle(shot.title)))).filter(Boolean);
  const renderReadyShots = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt) && shot.cameraNotes && shot.prompt).length;
  const visualBible = getVisualBibleBundle(project);
  const shotPresets = project.shots.slice(0, 6).map((shot) => {
    const binding = referenceBindings.effectiveShotMap.get(shot.id) || null;
    return getRenderPresetForShot(
      shot,
      visualBible,
      [],
      binding ? { promptLine: binding.promptLine, titles: binding.referenceTitles, note: binding.note } : null,
    );
  });
  const remoteCount = jobOutputs.filter(({ meta }) => meta.mode === 'remote').length;
  const mockCount = jobOutputs.filter(({ meta }) => meta.mode === 'mock').length;
  const beatMarkedShots = timeline?.scenes.reduce((sum, scene) => sum + scene.shots.filter((shot) => Boolean(shot.beatType)).length, 0) || 0;
  const manualDurationShots = timeline?.scenes.reduce((sum, scene) => sum + scene.shots.filter((shot) => shot.isManualDuration).length, 0) || 0;
  const readyShotRate = toPercent(renderReadyShots, project.shots.length);
  const completedRate = toPercent(summary.done, project.renderJobs.length);
  const remoteRate = toPercent(remoteCount, project.renderJobs.length);
  const readiness = getReadinessCopy({
    finalPreviewReady,
    failedCount: summary.failed,
    runningCount: summary.running,
    readyShotRate,
    renderReadyShots,
    shotCount: project.shots.length,
  });
  const exportLinks = {
    presets: `/api/render?action=export-presets&projectId=${project.id}`,
    providerPayloads: `/api/render?action=export-provider-payloads&projectId=${project.id}`,
    finalCut: `/api/render?action=export-final-cut-plan&projectId=${project.id}`,
    finalCutAssembly: `/api/render?action=export-final-cut-assembly&projectId=${project.id}`,
    finalCutAssemblePreview: `/api/render?action=assemble-final-cut-preview&projectId=${project.id}`,
    finalCutAssemblePreviewOpen: `/api/render?action=assemble-final-cut-preview&projectId=${project.id}&open=1`,
    productionBundle: `/api/render?action=export-production-bundle&projectId=${project.id}`,
  };

  return (
    <div className="page-stack">
      <div className="render-command-grid">
        <section className="snapshot-card render-command-card">
          <div className="render-panel-head">
            <div>
              <p className="eyebrow">Render Command</p>
              <h3>{project.title}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{readiness.title}</span>
          </div>

          <p>
            这一页现在聚焦三件事：先看当前任务推到哪里、再看哪些镜头已经满足生成条件、最后直接处理产物和交付入口。
          </p>

          <div className="meta-list">
            <span>分场 {project.scenes.length}</span>
            <span>镜头 {project.shots.length}</span>
            <span>参考增强 {flavoredCount}</span>
            <span>参考卡 {referenceProfile.total}</span>
            <span>可生成镜头 {renderReadyShots}</span>
            <span>真实执行 {remoteCount}</span>
            <span>模拟执行 {mockCount}</span>
          </div>

          <RenderGenerateButton projectId={project.id} />

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/storyboard', project.id)} className="button-ghost">返回分镜板</Link>
            <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
            <Link href={buildProjectHref('/assets', project.id)} className="button-secondary">查看资产中心</Link>
            <Link href={buildProjectHref('/render-runs', project.id)} className="button-secondary">查看运行诊断</Link>
          </div>
        </section>

        <aside className="render-command-side">
          <div className="render-kpi-grid">
            <div className="asset-tile render-kpi-card">
              <span className="label">镜头就绪</span>
              <h4>{readyShotRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill" style={{ width: `${readyShotRate}%` }} />
              </div>
              <p>{renderReadyShots} / {project.shots.length} 个镜头已经具备执行前置条件。</p>
            </div>

            <div className="asset-tile render-kpi-card">
              <span className="label">任务完成</span>
              <h4>{completedRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-2" style={{ width: `${completedRate}%` }} />
              </div>
              <p>已完成 {summary.done} 个任务，仍有 {summary.running + summary.queued} 个任务待推进。</p>
            </div>

            <div className="asset-tile render-kpi-card">
              <span className="label">成片推进</span>
              <h4>{finalPreviewReady ? '视频已就位' : '继续补视频'}</h4>
              <p>{finalPreviewReady ? '媒体索引里已经出现视频产物，可直接继续走成片链。' : '当前还没有稳定视频结果，建议继续执行视频任务。'}</p>
            </div>

            <div className="asset-tile render-kpi-card">
              <span className="label">真实执行占比</span>
              <h4>{remoteRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-3" style={{ width: `${remoteRate}%` }} />
              </div>
              <p>{remoteCount > 0 ? `${remoteCount} 个任务已调用真实 Provider。` : '当前仍以模拟闭环为主，可继续接入真实 Provider。'}</p>
            </div>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">当前焦点</span>
            <h4>{readiness.title}</h4>
            <p>{readiness.description}</p>
          </div>
        </aside>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.render} />
        </div>
      ) : null}

      <SectionCard
        eyebrow="Execution"
        title="当前执行态势"
        description="先看队列、运行、完成和失败四个状态，避免所有信息挤在一块。"
        actions={<Link href={buildProjectHref('/render-runs', project.id)} className="button-ghost">打开运行诊断</Link>}
      >
        <div className="render-stage-list">
          <div className="render-stage-item">
            <span className="label">排队中</span>
            <strong>{summary.queued}</strong>
            <p>适合确认当前批次是否已经完整创建。</p>
          </div>
          <div className="render-stage-item">
            <span className="label">执行中</span>
            <strong>{summary.running}</strong>
            <p>这里代表真实推进中的任务，需要重点盯进度和回查。</p>
          </div>
          <div className="render-stage-item">
            <span className="label">已完成</span>
            <strong>{summary.done}</strong>
            <p>完成的任务会把图片、音频或视频回写到媒体索引。</p>
          </div>
          <div className="render-stage-item">
            <span className="label">失败</span>
            <strong>{summary.failed}</strong>
            <p>失败项优先处理，避免后面成片阶段继续被阻塞。</p>
          </div>
        </div>

        <div className="render-ops-grid">
          <div className="asset-tile render-highlight-card">
            <span className="label">媒体索引</span>
            <h4>已沉淀 {mediaCounts.total} 条产物</h4>
            <p>图片 {mediaCounts.images} / 音频 {mediaCounts.audio} / 视频 {mediaCounts.videos}，所有结果统一回写到资产中心。</p>
          </div>
          <div className="asset-tile render-highlight-card">
            <span className="label">执行模式</span>
            <h4>{remoteCount > 0 ? '真实 + 模拟并存' : '当前以模拟闭环为主'}</h4>
            <p>{remoteCount > 0 ? `真实产物 ${mediaCounts.remote} 条，模拟产物 ${mediaCounts.mock} 条。` : '当前适合先打通链路，再逐步切到真实模型供应商。'}</p>
          </div>
          <div className="asset-tile render-highlight-card">
            <span className="label">最终预演</span>
            <h4>{finalPreviewReady ? '具备继续预演条件' : '仍需补全视频'}</h4>
            <p>{finalPreviewReady ? '已经有视频产物，下一步更适合检查质量和拼装路线。' : '先把关键镜头的视频结果补出来，成片阶段会顺很多。'}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Inputs"
        title="上游输入与执行约束"
        description="生成不是只看任务队列，视觉总控、参考绑定和时间线约束会直接影响结果稳定性。"
        actions={<Link href={buildProjectHref('/visual-bible', project.id)} className="button-ghost">前往视觉总控</Link>}
      >
        <div className="render-input-grid">
          <div className="asset-tile render-highlight-card">
            <span className="label">视觉圣经</span>
            <h4>{visualBible?.styleName || '尚未建立视觉总控'}</h4>
            <p>{visualBible?.visualTone || '建议先生成视觉圣经，让图像与视频使用统一风格约束。'}</p>
            {visualBible ? (
              <div className="meta-list">
                <span>{visualBible.palette}</span>
                <span>{visualBible.lighting}</span>
                <span>{visualBible.lensLanguage}</span>
              </div>
            ) : null}
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">参考系统</span>
            <h4>{referenceProfile.total} 张参考卡</h4>
            <p>{referenceProfile.titleSummary}</p>
            <div className="meta-list">
              <span>构图 {referenceProfile.framing}</span>
              <span>情绪 {referenceProfile.emotion}</span>
              <span>动作 {referenceProfile.movement}</span>
            </div>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">定向绑定</span>
            <h4>{referenceBindings.effectiveShotBindingCount} 个镜头已生效</h4>
            <p>分场绑定 {referenceBindings.sceneBindingCount} / 镜头直绑 {referenceBindings.shotBindingCount}，当前参考增强覆盖已经可直接喂给 Provider。</p>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">时间线约束</span>
            <h4>{timeline ? timeline.totalDurationLabel : '暂无时间线'}</h4>
            <p>{timeline ? `当前已有 ${beatMarkedShots} 个节拍标记，${manualDurationShots} 个镜头使用人工修时。` : '建议先进入时间线工作台，补齐时长与节拍。'}</p>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">导演语言</span>
            <h4>{directorReadyCount} / {project.scenes.length} 个分场已准备</h4>
            <p>带导演语言摘要的分场越多，后续图像和视频生成会越稳定。</p>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">镜头分类</span>
            <h4>{shotKinds.length > 0 ? `${shotKinds.length} 类镜头` : '暂无镜头分类'}</h4>
            {shotKinds.length > 0 ? (
              <div className="tag-list">
                {shotKinds.map((kind) => (
                  <span key={kind} className="tag-chip">{kind}</span>
                ))}
              </div>
            ) : (
              <p>先补齐分镜标题与镜头语言，策略卡会更清楚。</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Strategy"
        title="镜头策略与预设样例"
        description="把镜头策略和可执行 preset 放在同一个区块里，方便判断这轮生成到底在执行什么。"
      >
        {shotKinds.length > 0 ? (
          <div className="render-strategy-grid">
            {shotKinds.map((kind) => {
              const strategy = getRenderStrategy(kind);
              return (
                <div key={kind} className="asset-tile render-strategy-card">
                  <span className="label">镜头策略</span>
                  <h4>{kind}</h4>
                  <p><strong>画面：</strong>{strategy.visual}</p>
                  <p><strong>运动：</strong>{strategy.motion}</p>
                  <p>{strategy.useCase}</p>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="render-preset-grid">
          {shotPresets.map((preset) => (
            <div key={preset.shotId} className="asset-tile render-preset-card">
              <span className="label">Preset</span>
              <h4>{preset.shotTitle}</h4>
              <div className="meta-list">
                <span>类型 {preset.kind}</span>
                <span>节奏 {preset.pacing}</span>
                <span>重点 {preset.emphasis}</span>
              </div>
              <p><strong>视觉风格：</strong>{preset.visualStyle}</p>
              <p><strong>镜头运动：</strong>{preset.cameraMotion}</p>
              <p><strong>声音重点：</strong>{preset.audioFocus}</p>
              {preset.referenceTitles && preset.referenceTitles.length > 0 ? (
                <>
                  <div className="tag-list">
                    {preset.referenceTitles.map((title) => (
                      <span key={`${preset.shotId}-${title}`} className="tag-chip">{title}</span>
                    ))}
                  </div>
                  {preset.referencePromptLine ? <p><strong>定向参考：</strong>{preset.referencePromptLine}</p> : null}
                  {preset.referenceBindingNote ? <p><strong>绑定说明：</strong>{preset.referenceBindingNote}</p> : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Payload"
        title="Provider 载荷预检"
        description="进入真实调用前，先确认各供应商载荷是否已经带上参考增强、镜头上下文和模型配置。"
      >
        <RenderPayloadPreview projectId={project.id} />
      </SectionCard>

      <SectionCard
        eyebrow="Media"
        title="最新生成产物"
        description="这里优先看实际产物，不再把图片、音频、视频结果埋在长列表里。"
        actions={<Link href={buildProjectHref('/assets', project.id)} className="button-ghost">打开资产中心</Link>}
      >
        <div className="render-media-grid">
          {generatedMedia.length === 0 ? (
            <div className="asset-tile">
              <span className="label">空状态</span>
              <h4>还没有生成产物</h4>
              <p>执行渲染任务后，这里会优先展示最近沉淀的图片、音频和视频结果。</p>
            </div>
          ) : (
            generatedMedia.slice(0, 6).map((item) => {
              const previewKind = getPreviewKindFromGeneratedType(item.type);
              const previewHref = previewKind
                ? resolvePreviewSource({ kind: previewKind, sourceUrl: item.sourceUrl, localPath: item.localPath })
                : null;

              return (
                <div key={item.id} className="asset-tile scene-tile render-media-card">
                  <MediaPreview
                    kind={previewKind}
                    title={item.title}
                    sourceUrl={item.sourceUrl}
                    localPath={item.localPath}
                    fallbackLabel={
                      item.type === 'generated-video'
                        ? '视频预览'
                        : item.type === 'generated-audio'
                          ? '音频预览'
                          : '图片预览'
                    }
                  />
                  <span className="label">{getGeneratedMediaTypeLabel(item.type)}</span>
                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>
                  <div className="meta-list">
                    <span>模式 {getRenderExecutionModeLabel(item.mode)}</span>
                    <span>Provider {getRenderProviderLabel(item.provider)}</span>
                  </div>
                  <div className="action-row wrap-row compact-row">
                    {previewHref ? <a className="button-ghost" href={previewHref} target="_blank" rel="noreferrer">打开预览</a> : null}
                    {item.localPath ? <span className="tag-chip">本地工件</span> : null}
                    {item.sourceUrl ? <span className="tag-chip">远程链接</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Queue"
        title="任务队列与问题定位"
        description="任务队列只保留真正影响推进的信息：状态、模型、工件和下一步动作。"
      >
        <div className="render-job-grid">
          {project.renderJobs.length === 0 ? (
            <div className="asset-tile">
              <span className="label">空状态</span>
              <h4>还没有渲染任务</h4>
              <p>点击顶部按钮创建第一批渲染任务。</p>
            </div>
          ) : (
            jobOutputs.map(({ job, meta }) => (
              <div key={job.id} className="asset-tile render-job-card">
                <div className="render-job-card-head">
                  <div>
                    <span className="label">{getRenderJobStatusLabel(job.status)}</span>
                    <h4>{getRenderProviderLabel(job.provider)}</h4>
                  </div>
                  <span className="status-pill status-pill-subtle">{getRenderExecutionModeLabel(meta.mode)}</span>
                </div>

                <p>{meta.summary.join(' / ') || '暂无输出标记'}</p>

                <div className="meta-list">
                  <span>供应商 {meta.providerName || '未记录'}</span>
                  <span>模型 {meta.providerModel || '未指定模型'}</span>
                  <span>适配器 {meta.adapter || '未记录'}</span>
                  <span>重试 {meta.retryCount}</span>
                  <span>载荷 {meta.payloadCount}</span>
                  <span>产物 {meta.assetCount || 0}</span>
                </div>

                {meta.preview ? <p><strong>响应摘要：</strong>{meta.preview}</p> : null}
                {meta.lastError ? <p><strong>错误：</strong>{meta.lastError}</p> : null}

                <div className="tag-list">
                  {meta.endpoint ? <span className="tag-chip">Endpoint</span> : null}
                  {meta.requestPath ? <span className="tag-chip">Request</span> : null}
                  {meta.responsePath ? <span className="tag-chip">Response</span> : null}
                  {meta.pollTracePath ? <span className="tag-chip">Poll Trace</span> : null}
                  {meta.artifactIndexPath ? <span className="tag-chip">媒体索引</span> : null}
                  {meta.pendingTasks?.length ? <span className="tag-chip tag-chip-active">待回查 {meta.pendingTasks.length}</span> : null}
                </div>

                <div className="action-row wrap-row compact-row">
                  {job.status === 'queued' ? <RenderJobActionButton projectId={project.id} jobId={job.id} action="run" label="只执行这个任务" /> : null}
                  {job.status === 'running' ? <RenderJobActionButton projectId={project.id} jobId={job.id} action="advance" label="继续推进该任务" /> : null}
                  {job.status === 'failed' ? <RenderJobActionButton projectId={project.id} jobId={job.id} action="retry" label="只重试这个任务" /> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Export"
        title="导出与交付入口"
        description="把联调、预演拼装和交付打包入口集中到最后一步，减少在页面之间来回查找。"
      >
        <div className="render-export-grid">
          <div className="asset-tile render-highlight-card">
            <span className="label">联调导出</span>
            <h4>Preset JSON</h4>
            <p>导出镜头 preset JSON，适合先核对镜头策略和执行参数。</p>
            <a className="button-ghost" href={exportLinks.presets} target="_blank" rel="noreferrer">打开 Preset JSON</a>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">Provider 导出</span>
            <h4>可执行 Payload</h4>
            <p>集中导出 image / voice / video 三类 Provider 载荷。</p>
            <a className="button-ghost" href={exportLinks.providerPayloads} target="_blank" rel="noreferrer">打开 Provider Payload</a>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">成片计划</span>
            <h4>Final Cut JSON</h4>
            <p>直接把镜头顺序、视觉来源和音轨覆盖交给成片阶段。</p>
            <a className="button-ghost" href={exportLinks.finalCut} target="_blank" rel="noreferrer">打开 Final Cut JSON</a>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">预演装配</span>
            <h4>FFmpeg 预演包</h4>
            <p>导出装配包后，可以继续执行预演拼装，或者直接打开预演成片。</p>
            <div className="action-row wrap-row compact-row">
              <a className="button-ghost" href={exportLinks.finalCutAssembly} target="_blank" rel="noreferrer">打开装配包</a>
              <a className="button-ghost" href={exportLinks.finalCutAssemblePreview} target="_blank" rel="noreferrer">执行拼装</a>
              <a className="button-ghost" href={exportLinks.finalCutAssemblePreviewOpen} target="_blank" rel="noreferrer">拼装并打开</a>
            </div>
          </div>

          <div className="asset-tile render-highlight-card">
            <span className="label">生产交付</span>
            <h4>Production Bundle</h4>
            <p>导出媒体索引、成片计划、装配包和结构数据，方便归档交付。</p>
            <a className="button-ghost" href={exportLinks.productionBundle} target="_blank" rel="noreferrer">生成并查看交付包</a>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
