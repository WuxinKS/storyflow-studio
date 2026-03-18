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
import { getProviderProfileSnapshotMap, type ProviderProfileSnapshot } from '@/lib/provider-config';
import { buildProjectHref } from '@/lib/project-links';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';

type RenderLaneStatus = 'failed' | 'running' | 'queued' | 'done';

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

function getProviderStateLabel(profile: ProviderProfileSnapshot) {
  if (profile.executionModeHint === 'remote' && profile.apiKeyConfigured && profile.modelConfigured) {
    return '真实模型已就绪';
  }
  if (profile.executionModeHint === 'remote' && profile.apiKeyConfigured) {
    return '端点已接入';
  }
  if (profile.executionModeHint === 'remote') {
    return '待补密钥或模型';
  }
  return '当前走模拟闭环';
}

function getProviderStateDescription(input: {
  profile: ProviderProfileSnapshot;
  jobCount: number;
  outputCount: number;
}) {
  const { profile, jobCount, outputCount } = input;

  if (profile.executionModeHint === 'remote' && profile.apiKeyConfigured && profile.modelConfigured) {
    return `当前已接入 ${profile.providerName || '真实供应商'}，模型 ${profile.providerModel || '待补充'}，已有 ${jobCount} 个任务与 ${outputCount} 条产物经过这一通道。`;
  }

  if (profile.executionModeHint === 'remote') {
    return `端点已经写入，但模型或鉴权还没补齐。当前已有 ${jobCount} 个任务记录可用于联调。`;
  }

  return `当前仍走模拟闭环，用来先打通小说 → 分镜 → 图片 / 语音 / 视频 → 成片的整条主链。已有 ${outputCount} 条模拟产物。`;
}

function getLaneTitle(status: RenderLaneStatus) {
  if (status === 'failed') return '先处理失败项';
  if (status === 'running') return '盯住正在执行的任务';
  if (status === 'queued') return '准备发起下一轮';
  return '最近完成的任务';
}

function getLaneDescription(status: RenderLaneStatus) {
  if (status === 'failed') return '失败项会直接阻塞后面的成片链，优先回看错误、请求工件和 Provider 返回。';
  if (status === 'running') return '运行中的任务最值得盯进度，尤其是视频和音轨任务。';
  if (status === 'queued') return '这些任务已经排好队，确认输入没问题就可以单独执行或批量推进。';
  return '完成项只保留最近沉淀的结果，避免长列表把真正重要的状态淹没。';
}

function getRenderMission(input: {
  renderReadyShots: number;
  jobCount: number;
  failedCount: number;
  runningCount: number;
  queuedCount: number;
  finalPreviewReady: boolean;
  projectId: string;
}) {
  if (input.renderReadyShots === 0) {
    return {
      status: '待补镜头输入',
      title: '先把镜头补到可生成',
      guidance: '至少先补齐提示词、镜头备注和参考增强，再创建任务，否则后面只会堆失败记录。',
      kind: 'link' as const,
      actionHref: buildProjectHref('/storyboard', input.projectId),
      actionLabel: '回到分镜板补输入',
    };
  }

  if (input.finalPreviewReady) {
    return {
      status: '可交给成片预演',
      title: '进入成片预演',
      guidance: '已经有视频结果回流进媒体索引，这一站先交给 final cut 检查节奏和拼装质量。',
      kind: 'link' as const,
      actionHref: buildProjectHref('/final-cut', input.projectId),
      actionLabel: '进入成片预演',
    };
  }

  if (input.jobCount === 0) {
    return {
      status: '待创建任务',
      title: '创建首批生成任务',
      guidance: '先把当前可生成镜头落成图片、语音、视频任务，再开始盯队列和产物回流。',
      kind: 'generate' as const,
      primaryAction: 'create' as const,
      primaryLabel: '创建首批生成任务',
      primaryLoadingLabel: '正在创建首批生成任务…',
      helperText: '任务创建后，再决定是批量执行，还是先跑单一供应商。',
    };
  }

  if (input.failedCount > 0) {
    return {
      status: '先清失败任务',
      title: '重试失败任务',
      guidance: '失败任务会卡住后面的媒体回流，先把阻塞项清掉，再继续推进这一轮生成。',
      kind: 'generate' as const,
      primaryAction: 'retry' as const,
      primaryLabel: '重试失败任务',
      primaryLoadingLabel: '正在重试失败任务…',
      helperText: '如果只想处理单一供应商，可以展开下面的执行选项。',
    };
  }

  if (input.runningCount > 0) {
    return {
      status: '任务推进中',
      title: '继续推进执行中任务',
      guidance: '现在不用再开新任务，先盯住执行中的这批任务，把可回收的结果尽快推进出来。',
      kind: 'generate' as const,
      primaryAction: 'advance' as const,
      primaryLabel: '继续推进执行中任务',
      primaryLoadingLabel: '正在推进执行中任务…',
      helperText: '推进完成后，再回来看最新沉淀的图片、音频和视频结果。',
    };
  }

  if (input.queuedCount > 0) {
    return {
      status: '待执行队列',
      title: '执行排队中的任务',
      guidance: '任务已经建好了，现在最重要的是正式跑起来，让产物开始回流。',
      kind: 'generate' as const,
      primaryAction: 'run' as const,
      primaryLabel: '执行排队中的任务',
      primaryLoadingLabel: '正在执行排队中的任务…',
      helperText: '如需只跑图像、语音或视频，可展开更多执行选项。',
    };
  }

  return {
    status: '准备下一轮生成',
    title: '再创建一轮生成任务',
    guidance: '当前这批任务已经稳定，如果视频覆盖还不够，就再创建一轮新任务继续补齐。',
    kind: 'generate' as const,
    primaryAction: 'create' as const,
    primaryLabel: '再创建一轮生成任务',
    primaryLoadingLabel: '正在创建新一轮任务…',
    helperText: '通常先保证关键镜头有视频，再继续把覆盖率往上推。',
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
  const providerProfiles = getProviderProfileSnapshotMap();
  const providerCards = [
    {
      key: 'image-sequence',
      track: '图片生成',
      profile: providerProfiles.imageSequence,
      jobCount: jobOutputs.filter(({ job }) => job.provider === 'image-sequence').length,
      outputCount: generatedMedia.filter((item) => item.type === 'generated-image').length,
      outputLabel: `图片产物 ${generatedMedia.filter((item) => item.type === 'generated-image').length}`,
    },
    {
      key: 'voice-synthesis',
      track: '语音生成',
      profile: providerProfiles.voiceSynthesis,
      jobCount: jobOutputs.filter(({ job }) => job.provider === 'voice-synthesis').length,
      outputCount: generatedMedia.filter((item) => item.type === 'generated-audio').length,
      outputLabel: `音轨产物 ${generatedMedia.filter((item) => item.type === 'generated-audio').length}`,
    },
    {
      key: 'video-assembly',
      track: '视频生成',
      profile: providerProfiles.videoAssembly,
      jobCount: jobOutputs.filter(({ job }) => job.provider === 'video-assembly').length,
      outputCount: generatedMedia.filter((item) => item.type === 'generated-video').length,
      outputLabel: `视频产物 ${generatedMedia.filter((item) => item.type === 'generated-video').length}`,
    },
  ] as const;
  const laneOrder: RenderLaneStatus[] = ['failed', 'running', 'queued', 'done'];
  const jobLanes = laneOrder
    .map((status) => ({
      status,
      items: jobOutputs.filter(({ job }) => job.status === status),
    }))
    .filter((lane) => lane.items.length > 0);
  const latestTypedMedia = [
    generatedMedia.find((item) => item.type === 'generated-video'),
    generatedMedia.find((item) => item.type === 'generated-image'),
    generatedMedia.find((item) => item.type === 'generated-audio'),
  ].filter((item): item is (typeof generatedMedia)[number] => Boolean(item));
  const pinnedMediaIds = new Set(latestTypedMedia.map((item) => item.id));
  const mediaShowcase = [...latestTypedMedia, ...generatedMedia.filter((item) => !pinnedMediaIds.has(item.id))].slice(0, 6);
  const exportLinks = {
    presets: `/api/render?action=export-presets&projectId=${project.id}`,
    providerPayloads: `/api/render?action=export-provider-payloads&projectId=${project.id}`,
    finalCut: `/api/render?action=export-final-cut-plan&projectId=${project.id}`,
    finalCutAssembly: `/api/render?action=export-final-cut-assembly&projectId=${project.id}`,
    finalCutAssemblePreview: `/api/render?action=assemble-final-cut-preview&projectId=${project.id}`,
    finalCutAssemblePreviewOpen: `/api/render?action=assemble-final-cut-preview&projectId=${project.id}&open=1`,
    productionBundle: `/api/render?action=export-production-bundle&projectId=${project.id}`,
  };
  const renderMission = getRenderMission({
    renderReadyShots,
    jobCount: project.renderJobs.length,
    failedCount: summary.failed,
    runningCount: summary.running,
    queuedCount: summary.queued,
    finalPreviewReady,
    projectId: project.id,
  });

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
            这一页现在按一条更明确的执行链来组织：先确认镜头是否具备生成条件，再看三条模型供应商通道的状态，
            然后盯队列和产物，最后把结果直接交给成片预演。
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

          <div className="asset-tile render-focus-card">
            <span className="label">当前主任务</span>
            <h4>{renderMission.title}</h4>
            <p>{renderMission.guidance}</p>
            {renderMission.kind === 'generate' ? (
              <RenderGenerateButton
                projectId={project.id}
                primaryAction={renderMission.primaryAction}
                primaryLabel={renderMission.primaryLabel}
                primaryLoadingLabel={renderMission.primaryLoadingLabel}
                helperText={renderMission.helperText}
              />
            ) : (
              <div className="page-stack">
                <div className="action-row wrap-row">
                  <a href={renderMission.actionHref} className="button-primary">{renderMission.actionLabel}</a>
                </div>
                <details className="workflow-disclosure">
                  <summary>需要时继续生成任务</summary>
                  <div className="workflow-disclosure-body">
                    <RenderGenerateButton
                      projectId={project.id}
                      primaryAction="create"
                      primaryLabel="再创建一轮生成任务"
                      primaryLoadingLabel="正在创建新一轮任务…"
                      helperText="如果成片还缺关键镜头，可以在这里继续追加任务。"
                    />
                  </div>
                </details>
              </div>
            )}
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/storyboard', project.id)} className="button-ghost">返回分镜板</Link>
            <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
            <Link href={buildProjectHref('/settings', project.id)} className="button-secondary">查看模型设置</Link>
            <Link href={buildProjectHref('/render-runs', project.id)} className="button-secondary">查看运行诊断</Link>
            {finalPreviewReady ? <Link href={buildProjectHref('/final-cut', project.id)} className="button-secondary">进入成片预演</Link> : null}
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
        eyebrow="Flow"
        title="这一页只看四件事"
        description="先看输入是否能生成，再看队列、产物和成片交接，不把高级联调信息铺满首页。"
      >
        <div className="render-flow-grid">
          <div className="asset-tile render-flow-card">
            <span className="label">上游准备</span>
            <h4>{readyShotRate >= 70 ? '输入约束已经成型' : '上游输入还需补齐'}</h4>
            <p>
              参考增强 {flavoredCount} 个镜头、导演语言 {directorReadyCount} 个分场、节拍标记 {beatMarkedShots} 个镜头，
              当前最重要的是把可执行镜头继续推高。
            </p>
            <div className="meta-list">
              <span>参考绑定 {referenceBindings.effectiveShotBindingCount}</span>
              <span>人工修时 {manualDurationShots}</span>
              <span>时间线 {timeline?.totalDurationLabel || '未建立'}</span>
            </div>
          </div>

          <div className="asset-tile render-flow-card">
            <span className="label">任务执行</span>
            <h4>{summary.failed > 0 ? '先处理失败任务' : summary.running > 0 ? '队列正在推进' : summary.queued > 0 ? '准备执行下一批' : '当前批次已稳定'}</h4>
            <p>
              当前有 {summary.running} 个执行中任务、{summary.queued} 个排队任务、{summary.failed} 个失败任务。
              队列健康时，再继续扩大真实 Provider 占比最稳。
            </p>
            <div className="meta-list">
              <span>执行中 {summary.running}</span>
              <span>排队中 {summary.queued}</span>
              <span>失败 {summary.failed}</span>
            </div>
          </div>

          <div className="asset-tile render-flow-card">
            <span className="label">产物回流</span>
            <h4>{mediaCounts.total > 0 ? '生成结果正在沉淀' : '还没有产物回写'}</h4>
            <p>
              图片 {mediaCounts.images} / 音频 {mediaCounts.audio} / 视频 {mediaCounts.videos} 全部统一进入媒体索引，
              后续可直接回到资产中心和成片预演复用。
            </p>
            <div className="meta-list">
              <span>真实产物 {mediaCounts.remote}</span>
              <span>模拟产物 {mediaCounts.mock}</span>
              <span>总计 {mediaCounts.total}</span>
            </div>
          </div>

          <div className="asset-tile render-flow-card">
            <span className="label">成片交接</span>
            <h4>{finalPreviewReady ? '已经能交给成片预演' : '暂时还卡在视频覆盖'}</h4>
            <p>
              {finalPreviewReady
                ? '当前至少已经有视频结果进入媒体索引，接下来更适合去 final cut 检查质量、节奏和拼装。'
                : 'final cut 仍优先依赖视频片段，建议先把关键镜头的视频任务跑出来。'}
            </p>
            <div className="meta-list">
              <span>视频结果 {mediaCounts.videos}</span>
              <span>成片入口 {finalPreviewReady ? '已打开' : '待补齐'}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Providers"
        title="模型供应商通道"
        description="图片、语音、视频三条供应商通道分开看，避免 Provider 状态被长队列淹没。"
        actions={<Link href={buildProjectHref('/settings', project.id)} className="button-ghost">打开模型设置</Link>}
      >
        <div className="render-provider-grid">
          {providerCards.map((card) => (
            <div key={card.key} className="asset-tile render-provider-card">
              <div className="render-panel-head">
                <div>
                  <span className="label">{card.track}</span>
                  <h4>{getProviderStateLabel(card.profile)}</h4>
                </div>
                <span className="status-pill status-pill-subtle">{getRenderProviderLabel(card.key)}</span>
              </div>

              <p>{getProviderStateDescription(card)}</p>

              <div className="meta-list">
                <span>供应商 {card.profile.providerName || '未命名'}</span>
                <span>模型 {card.profile.providerModel || '未指定'}</span>
                <span>适配器 {card.profile.adapter || '默认'}</span>
                <span>任务 {card.jobCount}</span>
                <span>{card.outputLabel}</span>
              </div>

              <div className="tag-list">
                <span className="tag-chip">{card.profile.executionModeHint === 'remote' ? '真实端点' : '模拟闭环'}</span>
                {card.profile.url ? <span className="tag-chip">Endpoint 已配置</span> : null}
                {card.profile.apiKeyConfigured ? <span className="tag-chip">鉴权已配置</span> : null}
                {card.profile.modelConfigured ? <span className="tag-chip">模型已声明</span> : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Media"
        title="最新生成产物"
        description="先看最近沉淀的图片、音频、视频结果，再决定回去补任务还是直接进入成片链。"
        actions={<Link href={buildProjectHref('/assets', project.id)} className="button-ghost">打开资产中心</Link>}
      >
        <div className="render-media-summary-grid">
          <div className="asset-tile render-media-summary-card">
            <span className="label">图片结果</span>
            <h4>{mediaCounts.images}</h4>
            <p>主要承接角色图、场景图、分镜关键帧和图片回退结果。</p>
          </div>
          <div className="asset-tile render-media-summary-card">
            <span className="label">音频结果</span>
            <h4>{mediaCounts.audio}</h4>
            <p>主要服务场次音轨、对白或语音样片，后面会直接进入成片装配。</p>
          </div>
          <div className="asset-tile render-media-summary-card">
            <span className="label">视频结果</span>
            <h4>{mediaCounts.videos}</h4>
            <p>视频片段越完整，final cut 越少依赖图片回退，预演质量也更稳定。</p>
          </div>
        </div>

        <div className="render-media-grid">
          {mediaShowcase.length === 0 ? (
            <div className="asset-tile">
              <span className="label">空状态</span>
              <h4>还没有生成产物</h4>
              <p>执行渲染任务后，这里会优先展示最近沉淀的图片、音频和视频结果。</p>
            </div>
          ) : (
            mediaShowcase.map((item) => {
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
        description="把失败、运行、排队、完成四种状态拆成独立泳道，先解决阻塞，再看最近沉淀。"
        actions={<Link href={buildProjectHref('/render-runs', project.id)} className="button-ghost">打开完整运行诊断</Link>}
      >
        {jobLanes.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有渲染任务</h4>
            <p>点击顶部按钮创建第一批渲染任务。</p>
          </div>
        ) : (
          <div className="render-job-board">
            {jobLanes.map((lane) => {
              const visibleJobs = lane.status === 'done' ? lane.items.slice(0, 4) : lane.items.slice(0, 6);

              return (
                <section key={lane.status} className="render-job-lane">
                  <div className="render-panel-head">
                    <div>
                      <span className="label">{getRenderJobStatusLabel(lane.status)}</span>
                      <h4>{getLaneTitle(lane.status)}</h4>
                    </div>
                    <span className="status-pill status-pill-subtle">{lane.items.length} 个</span>
                  </div>

                  <p>{getLaneDescription(lane.status)}</p>

                  <div className="render-job-list">
                    {visibleJobs.map(({ job, meta }) => (
                      <div key={job.id} className="asset-tile render-job-card">
                        <div className="render-job-card-head">
                          <div>
                            <span className="label">{getRenderProviderLabel(job.provider)}</span>
                            <h4>{meta.providerModel || meta.providerName || '未记录模型信息'}</h4>
                          </div>
                          <span className="status-pill status-pill-subtle">{getRenderExecutionModeLabel(meta.mode)}</span>
                        </div>

                        <p>{meta.summary.join(' / ') || '暂无输出标记'}</p>

                        <div className="meta-list">
                          <span>状态 {getRenderJobStatusLabel(job.status)}</span>
                          <span>供应商 {meta.providerName || '未记录'}</span>
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
                    ))}
                  </div>

                  {lane.items.length > visibleJobs.length ? (
                    <p className="muted-copy">当前仅展示最近 {visibleJobs.length} 个任务，更多记录可在运行诊断中查看。</p>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Advanced"
        title="高级调试与导出"
        description="默认先推进任务；只有在需要精查输入、载荷或交付工件时，再展开下面三组内容。"
      >
        <div className="page-stack">
          <details className="workflow-disclosure">
            <summary>查看上游输入与镜头策略</summary>
            <div className="workflow-disclosure-body">
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
            </div>
          </details>

          <details className="workflow-disclosure">
            <summary>查看 Provider 载荷预检</summary>
            <div className="workflow-disclosure-body">
              <RenderPayloadPreview projectId={project.id} />
            </div>
          </details>

          <details className="workflow-disclosure">
            <summary>查看导出与交付入口</summary>
            <div className="workflow-disclosure-body">
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
            </div>
          </details>
        </div>
      </SectionCard>
    </div>
  );
}
