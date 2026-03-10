import Link from 'next/link';
import { RenderGenerateButton } from '@/components/render-generate-button';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import {
  getRenderExecutionModeLabel,
  getRenderJobStatusLabel,
  getRenderProviderLabel,
} from '@/lib/display';
import { getRenderPresetForShot, getRenderProject, parseRenderJobOutput } from '@/features/render/service';
import { getTimelineBundle } from '@/features/timeline/service';
import { getGeneratedMediaEntries, summarizeGeneratedMediaCounts } from '@/features/media/service';
import { buildReferenceProfile } from '@/features/reference/service';
import { getSyncStatus } from '@/features/sync/service';
import { getVisualBibleBundle } from '@/features/visual/service';
import { getShotKindFromTitle } from '@/lib/shot-taxonomy';
import { buildProjectHref } from '@/lib/project-links';

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
  const shotKinds = Array.from(new Set(project.shots.map((shot) => getShotKindFromTitle(shot.title))));
  const renderReadyShots = project.shots.filter((shot) => hasReferenceFlavor(shot.prompt) && shot.cameraNotes && shot.prompt).length;
  const visualBible = getVisualBibleBundle(project);
  const shotPresets = project.shots.slice(0, 6).map((shot) => getRenderPresetForShot(shot, visualBible));
  const remoteCount = jobOutputs.filter(({ meta }) => meta.mode === 'remote').length;
  const beatMarkedShots = timeline?.scenes.reduce((sum, scene) => sum + scene.shots.filter((shot) => Boolean(shot.beatType)).length, 0) || 0;
  const manualDurationShots = timeline?.scenes.reduce((sum, scene) => sum + scene.shots.filter((shot) => shot.isManualDuration).length, 0) || 0;
  const mockCount = jobOutputs.filter(({ meta }) => meta.mode === 'mock').length;

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">生成总览</p>
        <h3>{project.title}</h3>
        <p>当前生成工作台不仅能组织任务，还会把图片、音频、视频产物回写到统一媒体索引，方便后续资产管理、交付和复验。</p>
        <div className="meta-list">
          <span>分场：{project.scenes.length}</span>
          <span>镜头：{project.shots.length}</span>
          <span>参考增强：{flavoredCount}</span>
          <span>参考卡：{referenceProfile.total}</span>
          <span>可生成镜头：{renderReadyShots}</span>
          <span>真实执行：{remoteCount}</span>
          <span>模拟执行：{mockCount}</span>
        </div>
        <RenderGenerateButton projectId={project.id} />
        <div className="action-row">
          <Link href={buildProjectHref('/storyboard', project.id)} className="button-ghost">返回分镜板</Link>
          <Link href={buildProjectHref('/visual-bible', project.id)} className="button-secondary">查看视觉圣经</Link>
          <Link href={buildProjectHref('/assets', project.id)} className="button-secondary">查看资产中心</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">流水线</span>
          <h4>任务状态</h4>
          <p>排队中：{summary.queued}</p>
          <p>执行中：{summary.running}</p>
          <p>已完成：{summary.done}</p>
          <p>失败：{summary.failed}</p>
        </div>
        <div className="asset-tile">
          <span className="label">交付状态</span>
          <h4>成片状态</h4>
          <p>{finalPreviewReady ? '已有视频产物进入媒体索引，可继续走交付。' : '成片尚未准备好，继续执行任务或重试失败项。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">执行模式</span>
          <h4>真实 / 模拟切换</h4>
          <p>{remoteCount > 0 ? '当前已有真实 Provider 被调用。' : '当前未配置真实 endpoint，系统统一走模拟执行闭环。'}</p>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.render} />
        </div>
      ) : null}

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">媒体索引</span>
          <h4>已沉淀产物</h4>
          <p>总计 {mediaCounts.total} 条，图片 {mediaCounts.images} / 音频 {mediaCounts.audio} / 视频 {mediaCounts.videos}</p>
        </div>
        <div className="asset-tile">
          <span className="label">产物模式</span>
          <h4>真实与模拟</h4>
          <p>真实产物 {mediaCounts.remote} 条 / 模拟产物 {mediaCounts.mock} 条</p>
        </div>
        <div className="asset-tile">
          <span className="label">媒体回写</span>
          <h4>资产中心联动</h4>
          <p>{mediaCounts.total > 0 ? '当前生成结果已同步到媒体索引，可在资产中心统一查看。' : '当前还没有可沉淀的媒体产物，建议先执行渲染任务。'}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">视觉圣经</span>
          <h4>{visualBible?.styleName || '尚未生成视觉圣经'}</h4>
          <p>{visualBible?.visualTone || '建议先生成视觉圣经，让生成链使用统一的视觉总控。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">色彩与光线</span>
          <h4>整体画面约束</h4>
          <p>{visualBible ? `${visualBible.palette} / ${visualBible.lighting}` : '当前还没有色彩与光线总控。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">镜头与运动</span>
          <h4>运动规则</h4>
          <p>{visualBible ? `${visualBible.lensLanguage} / ${visualBible.motionLanguage}` : '当前还没有镜头与运动语言总控。'}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">场景覆盖</span>
          <h4>导演语言覆盖</h4>
          <p>{directorReadyCount} / {project.scenes.length} 个分场已带导演语言摘要。</p>
        </div>
        <div className="asset-tile">
          <span className="label">镜头分类</span>
          <h4>可渲染镜头类型</h4>
          <p>{shotKinds.join(' / ') || '暂无镜头类型'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">分场标题</span>
          <h4>当前分场标题</h4>
          <p>{project.scenes.map((scene) => scene.title).join(' / ') || '暂无分场标题'}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">参考构图</span>
          <h4>注入到图像 / 视频</h4>
          <p>{referenceProfile.framing}</p>
        </div>
        <div className="asset-tile">
          <span className="label">参考情绪</span>
          <h4>注入到分镜 / 配音</h4>
          <p>{referenceProfile.emotion} / {referenceProfile.movement}</p>
        </div>
        <div className="asset-tile">
          <span className="label">参考锚点</span>
          <h4>当前主参考</h4>
          <p>{referenceProfile.titleSummary}</p>
        </div>
      </div>
      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">时间线总长</span>
          <h4>视频时长基线</h4>
          <p>{timeline ? `${timeline.totalDurationLabel}（${timeline.totalSeconds} 秒）` : '当前还没有时间线数据。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">节拍标记</span>
          <h4>峰值 / 高潮覆盖</h4>
          <p>{timeline ? `已标记 ${beatMarkedShots} 个镜头，帮助视频拼装识别重点段落。` : '当前还没有节拍标记。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">手动修时</span>
          <h4>时间线联动</h4>
          <p>{timeline ? `已有 ${manualDurationShots} 个镜头使用人工修时，Render payload 会直接继承。` : '当前还没有手动修时信息。'}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        {shotKinds.map((kind) => {
          const strategy = getRenderStrategy(kind);
          return (
            <div key={kind} className="asset-tile">
              <span className="label">生成策略</span>
              <h4>{kind}</h4>
              <p><strong>画面：</strong>{strategy.visual}</p>
              <p><strong>运动：</strong>{strategy.motion}</p>
              <p>{strategy.useCase}</p>
            </div>
          );
        })}
      </div>

      <div className="asset-grid">
        {shotPresets.map((preset) => (
          <div key={preset.shotId} className="asset-tile">
            <span className="label">预设卡</span>
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
          <span className="label">接口导出</span>
          <h4>Preset JSON 导出</h4>
          <p>可通过 <code>/api/render?action=export-presets&amp;projectId={project.id}</code> 获取结构化 preset JSON。</p>
        </div>
        <div className="asset-tile">
          <span className="label">Provider 导出</span>
          <h4>Provider 可执行载荷</h4>
          <p>可通过 <code>/api/render?action=export-provider-payloads&amp;projectId={project.id}</code> 获取按 image / voice / video 分组的可执行 payload。</p>
        </div>
        <div className="asset-tile">
          <span className="label">交付包导出</span>
          <h4>生产交付包</h4>
          <p>交付包现在会同时带上媒体索引，便于把生成产物和结构数据一起归档。</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        {generatedMedia.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有生成产物</h4>
            <p>执行渲染任务后，这里会展示最新沉淀的图片、音频和视频产物。</p>
          </div>
        ) : (
          generatedMedia.slice(0, 6).map((item) => (
            <div key={item.id} className="asset-tile scene-tile">
              <span className="label">{getGeneratedMediaTypeLabel(item.type)}</span>
              <h4>{item.title}</h4>
              <p>{item.summary}</p>
              <div className="meta-list">
                <span>模式：{getRenderExecutionModeLabel(item.mode)}</span>
                <span>Provider：{getRenderProviderLabel(item.provider)}</span>
              </div>
              {item.localPath ? <p>文件：{item.localPath}</p> : null}
              {item.sourceUrl ? <p>链接：{item.sourceUrl}</p> : null}
            </div>
          ))
        )}
      </div>

      <div className="asset-grid three-up">
        {project.renderJobs.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有渲染任务</h4>
            <p>点击上方按钮创建第一批渲染任务。</p>
          </div>
        ) : (
          jobOutputs.map(({ job, meta }) => (
            <div key={job.id} className="asset-tile scene-tile">
              <span className="label">{getRenderJobStatusLabel(job.status)}</span>
              <h4>{getRenderProviderLabel(job.provider)}</h4>
              <p>{meta.summary.join(' / ') || '暂无输出标记'}</p>
              <div className="meta-list">
                <span>模式：{getRenderExecutionModeLabel(meta.mode)}</span>
                <span>重试：{meta.retryCount}</span>
                <span>载荷：{meta.payloadCount}</span>
                <span>产物：{meta.assetCount || 0}</span>
              </div>
              {meta.preview ? <p>响应摘要：{meta.preview}</p> : null}
              {meta.artifactIndexPath ? <p>索引：{meta.artifactIndexPath}</p> : null}
              {meta.lastError ? <p>错误：{meta.lastError}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
