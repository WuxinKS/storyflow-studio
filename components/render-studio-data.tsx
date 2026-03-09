import Link from 'next/link';
import { RenderGenerateButton } from '@/components/render-generate-button';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getRenderPresetForShot, getRenderProject, parseRenderJobOutput } from '@/features/render/service';
import { getSyncStatus } from '@/features/sync/service';
import { getVisualBibleBundle } from '@/features/visual/service';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';

function summarizeStatus(statuses: string[]) {
  const done = statuses.filter((s) => s === 'done').length;
  const running = statuses.filter((s) => s === 'running').length;
  const queued = statuses.filter((s) => s === 'queued').length;
  const failed = statuses.filter((s) => s === 'failed').length;
  return { done, running, queued, failed };
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
      visual: 'wide / environment / layered composition',
      motion: 'slow push / slow pan / stable opening frame',
      useCase: '适合先建立空间关系、场域压迫感与人物位置。',
    },
    细节观察: {
      visual: 'macro / close-up / texture emphasis',
      motion: 'micro movement / focus pull / detail-led framing',
      useCase: '适合拍线索、物件、手部动作、微表情与察觉过程。',
    },
    感官压迫: {
      visual: 'tight framing / flicker / high texture contrast',
      motion: 'sound-led tension / subtle shake / pressure build-up',
      useCase: '适合警示灯、异响、液体、气压变化等生理不安场景。',
    },
    情绪落点: {
      visual: 'close-up / performance hold / emotional isolation',
      motion: 'still hold / slow breath pacing / minimal movement',
      useCase: '适合停顿、呼吸、表情收束和情绪余波。',
    },
    关系压迫: {
      visual: 'over-shoulder / compressed distance / opposing eyelines',
      motion: 'push-in tension / locked confrontation framing',
      useCase: '适合对峙、权力关系、距离压迫与视线博弈。',
    },
    动作触发: {
      visual: 'directional framing / action-first composition',
      motion: 'motion emphasis / dynamic reframing / acceleration cues',
      useCase: '适合动作起点、决策瞬间、冲突触发和节奏切换。',
    },
    对白博弈: {
      visual: 'shot-reverse-shot / over-shoulder / reaction emphasis',
      motion: 'pause-response rhythm / controlled cutting cadence',
      useCase: '适合对白压力、反应镜头与台词权力结构。',
    },
  };

  return strategyMap[kind] || {
    visual: 'balanced cinematic framing',
    motion: 'moderate camera movement',
    useCase: '适合作为通用镜头策略 fallback。',
  };
}

export async function RenderStudioData() {
  const project = await getRenderProject().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">empty</span>
        <h4>暂无渲染项目</h4>
        <p>先完成 storyboard 数据，再创建渲染任务。</p>
      </div>
    );
  }

  const summary = summarizeStatus(project.renderJobs.map((job) => job.status));
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const jobOutputs = project.renderJobs.map((job) => ({
    job,
    meta: parseRenderJobOutput(job.outputUrl),
  }));
  const finalPreviewReady = jobOutputs.some(
    ({ job, meta }) => job.provider === 'video-assembly' && meta.summary.some((item) => item.includes('final-cut:preview-ready')),
  );
  const flavoredCount = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt)).length;
  const directorReadyCount = project.scenes.filter((scene) => hasDirectorLanguage(scene.summary)).length;
  const shotKinds = Array.from(new Set(project.shots.map((shot) => getShotKindFromTitle(shot.title))));
  const renderReadyShots = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt) && shot.cameraNotes && shot.prompt).length;
  const visualBible = getVisualBibleBundle(project);
  const shotPresets = project.shots.slice(0, 6).map((shot) => getRenderPresetForShot(shot, visualBible));
  const remoteCount = jobOutputs.filter(({ meta }) => meta.mode === 'remote').length;
  const mockCount = jobOutputs.filter(({ meta }) => meta.mode === 'mock').length;

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">Render Overview</p>
        <h3>{project.title}</h3>
        <p>当前 Render Studio 已支持真实 provider 调用入口；若未配置真实 endpoint，则会落到 mock 执行，但同样会生成请求/响应工件，方便 QA 和交付复验。</p>
        <div className="meta-list">
          <span>Scenes：{project.scenes.length}</span>
          <span>Shots：{project.shots.length}</span>
          <span>Reference-enhanced：{flavoredCount}</span>
          <span>Render-ready shots：{renderReadyShots}</span>
          <span>Remote：{remoteCount}</span>
          <span>Mock：{mockCount}</span>
        </div>
        <RenderGenerateButton projectId={project.id} />
        <div className="action-row">
          <Link href="/storyboard" className="button-ghost">返回 Storyboard</Link>
          <Link href="/visual-bible" className="button-secondary">查看视觉圣经</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">pipeline</span>
          <h4>任务状态</h4>
          <p>queued：{summary.queued}</p>
          <p>running：{summary.running}</p>
          <p>done：{summary.done}</p>
          <p>failed：{summary.failed}</p>
        </div>
        <div className="asset-tile">
          <span className="label">deliverable</span>
          <h4>成片状态</h4>
          <p>{finalPreviewReady ? 'final-cut 已准备预览' : '成片尚未准备好，继续执行任务或重试失败项。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">execution</span>
          <h4>执行模式</h4>
          <p>{remoteCount > 0 ? '已接入真实 provider 调用' : '当前未配置真实 endpoint，使用 mock 执行闭环。'}</p>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.render} />
        </div>
      ) : null}

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">visual bible</span>
          <h4>{visualBible?.styleName || '尚未生成视觉圣经'}</h4>
          <p>{visualBible?.visualTone || '建议先生成视觉圣经，让 Render 使用全片统一的视觉总控。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">palette & light</span>
          <h4>色彩 / 光线约束</h4>
          <p>{visualBible ? `${visualBible.palette} / ${visualBible.lighting}` : '当前还没有色彩与光线总控。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">lens & motion</span>
          <h4>镜头 / 运动约束</h4>
          <p>{visualBible ? `${visualBible.lensLanguage} / ${visualBible.motionLanguage}` : '当前还没有镜头与运动语言总控。'}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">scene coverage</span>
          <h4>导演场景覆盖</h4>
          <p>{directorReadyCount} / {project.scenes.length} 个 scene 已带导演语言摘要。</p>
        </div>
        <div className="asset-tile">
          <span className="label">shot taxonomy</span>
          <h4>可渲染镜头类型</h4>
          <p>{shotKinds.join(' / ') || '暂无镜头类型'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">scene titles</span>
          <h4>当前分场标题</h4>
          <p>{project.scenes.map((scene) => scene.title).join(' / ') || '暂无分场标题'}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        {shotKinds.map((kind) => {
          const strategy = getRenderStrategy(kind);
          return (
            <div key={kind} className="asset-tile">
              <span className="label">render strategy</span>
              <h4>{kind}</h4>
              <p><strong>Visual:</strong> {strategy.visual}</p>
              <p><strong>Motion:</strong> {strategy.motion}</p>
              <p>{strategy.useCase}</p>
            </div>
          );
        })}
      </div>

      <div className="asset-grid">
        {shotPresets.map((preset) => (
          <div key={preset.shotId} className="asset-tile">
            <span className="label">render preset</span>
            <h4>{preset.shotTitle}</h4>
            <p><strong>镜头类型：</strong>{preset.kind}</p>
            <p><strong>视觉风格：</strong>{preset.visualStyle}</p>
            <p><strong>镜头运动：</strong>{preset.cameraMotion}</p>
            <p><strong>节奏：</strong>{preset.pacing}</p>
            <p><strong>强调重点：</strong>{preset.emphasis}</p>
            <p><strong>声音重点：</strong>{preset.audioFocus}</p>
          </div>
        ))}
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">api export</span>
          <h4>Preset JSON 导出</h4>
          <p>可通过 <code>/api/render?action=export-presets&amp;projectId={project.id}</code> 获取结构化 preset JSON。</p>
        </div>
        <div className="asset-tile">
          <span className="label">provider export</span>
          <h4>Provider-ready Payload</h4>
          <p>可通过 <code>/api/render?action=export-provider-payloads&amp;projectId={project.id}</code> 获取按 image / voice / video 分组的可执行 payload。</p>
        </div>
        <div className="asset-tile">
          <span className="label">production bundle</span>
          <h4>生产交付包</h4>
          <p>可通过 <code>/api/render?action=export-production-bundle&amp;projectId={project.id}</code> 在 <code>exports/</code> 目录落盘完整交付包。</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        {project.renderJobs.length === 0 ? (
          <div className="asset-tile">
            <span className="label">empty</span>
            <h4>还没有渲染任务</h4>
            <p>点击上方按钮创建第一批 render job。</p>
          </div>
        ) : (
          jobOutputs.map(({ job, meta }) => (
            <div key={job.id} className="asset-tile scene-tile">
              <span className="label">{job.status}</span>
              <h4>{job.provider || 'unknown-provider'}</h4>
              <p>{meta.summary.join(' / ') || '暂无输出标记'}</p>
              <div className="meta-list">
                <span>模式：{meta.mode}</span>
                <span>重试：{meta.retryCount}</span>
                <span>载荷：{meta.payloadCount}</span>
              </div>
              {meta.preview ? <p>响应摘要：{meta.preview}</p> : null}
              {meta.lastError ? <p>错误：{meta.lastError}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
