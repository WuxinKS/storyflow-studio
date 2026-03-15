import Link from 'next/link';
import { MediaPreview } from '@/components/media-preview';
import { getFinalCutPlan } from '@/features/final-cut/service';
import { buildLocalMediaPreviewHref, getPreviewKindFromGeneratedType } from '@/lib/media-preview';
import { buildProjectHref } from '@/lib/project-links';

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分 ${seconds}秒`;
}

function getVisualSourceLabel(kind: 'video' | 'image' | 'missing') {
  if (kind === 'video') return '视频片段';
  if (kind === 'image') return '图片回退';
  return '缺失';
}

export async function FinalCutData({ projectId }: { projectId?: string }) {
  const plan = await getFinalCutPlan(projectId).catch(() => null);

  if (!plan) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>还没有成片预演数据</h4>
        <p>先完成时间线与渲染任务，系统才能基于镜头顺序、音轨与产物自动生成最终拼装计划。</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">成片预演</p>
        <h3>{plan.projectTitle}</h3>
        <p>这里会按照时间线顺序把每个镜头最终采用的视频片段 / 图片回退、场次音轨与参考绑定汇总成一份可复核的 final cut 计划。</p>
        <div className="meta-list">
          <span>总时长：{plan.totalDurationLabel}</span>
          <span>场次：{plan.summary.sceneCount}</span>
          <span>镜头：{plan.summary.shotCount}</span>
          <span>视频覆盖：{plan.summary.videoCoverageRate}%</span>
          <span>视觉覆盖：{plan.summary.visualCoverageRate}%</span>
          <span>音轨覆盖：{plan.summary.audioCoverageRate}%</span>
        </div>
        <div className="action-row wrap-row">
          <Link href={buildProjectHref('/render-studio', plan.projectId)} className="button-secondary">返回生成工作台</Link>
          <a className="button-ghost" href={`/api/render?action=export-final-cut-plan&projectId=${plan.projectId}`} target="_blank" rel="noreferrer">导出 Final Cut JSON</a>
          <a className="button-ghost" href={`/api/render?action=export-final-cut-assembly&projectId=${plan.projectId}`} target="_blank" rel="noreferrer">导出装配包 JSON</a>
          <a className="button-ghost" href={`/api/render?action=assemble-final-cut-preview&projectId=${plan.projectId}&open=1`} target="_blank" rel="noreferrer">一键拼装并打开预演</a>
          <Link href={buildProjectHref('/render-runs', plan.projectId)} className="button-ghost">查看运行诊断</Link>
          <Link href={buildProjectHref('/delivery-center', plan.projectId)} className="button-ghost">查看交付中心</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">拼装状态</span>
          <h4>{plan.summary.readyForFullVideo ? '完整成片就绪' : plan.summary.readyForAssembly ? '可拼装预演版' : '仍有关键缺口'}</h4>
          <p>
            {plan.summary.readyForFullVideo
              ? '所有镜头都已有视频片段，且每个场次都已找到音轨，可直接交给最终成片拼装链。'
              : plan.summary.readyForAssembly
                ? '所有镜头至少已有视觉产物，但仍有部分镜头用图片回退或部分场次缺音轨，适合先走预演版。'
                : '仍有镜头缺少视觉产物，建议继续执行图像 / 视频 Provider。'}
          </p>
        </div>
        <div className="asset-tile">
          <span className="label">视频覆盖</span>
          <h4>{plan.summary.readyVideoShots} / {plan.summary.shotCount}</h4>
          <p>图片回退 {plan.summary.imageFallbackShots} 镜头，视觉缺失 {plan.summary.missingVisualShots} 镜头。</p>
        </div>
        <div className="asset-tile">
          <span className="label">音轨覆盖</span>
          <h4>{plan.summary.scenesWithAudio} / {plan.summary.sceneCount}</h4>
          <p>当前仍有 {plan.summary.scenesWithoutAudio} 个场次缺少配音 / 音轨，会影响最终成片拼装的完整性。</p>
        </div>
        <div className="asset-tile">
          <span className="label">装配状态</span>
          <h4>{plan.summary.assemblyState === 'ready-full-video' ? '完整视频版' : plan.summary.assemblyState === 'ready-preview' ? '预演拼装版' : '仍被阻塞'}</h4>
          <p>{plan.recommendedActions[0] || '当前没有额外动作建议。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">装配导出</span>
          <h4>FFmpeg 预演包</h4>
          <p>导出后会生成镜头片段清单、场次音轨清单和 <code>assemble-final-cut.sh</code>，也可直接点上方“一键拼装并打开预演”自动生成成片。</p>
        </div>
      </div>

      <div className="asset-grid">
        {plan.warnings.length === 0 ? (
          <div className="asset-tile">
            <span className="label">拼装提醒</span>
            <h4>当前没有明显缺口</h4>
            <p>时间线、镜头视觉与场次音轨都已覆盖到位，可以继续走最终成片拼装。</p>
          </div>
        ) : (
          plan.warnings.map((warning) => (
            <div key={warning} className="asset-tile">
              <span className="label">提醒</span>
              <h4>{warning}</h4>
              <p>建议回到生成工作台或运行诊断继续补齐这段缺口。</p>
            </div>
          ))
        )}
        {plan.recommendedActions.map((action) => (
          <div key={action} className="asset-tile">
            <span className="label">建议</span>
            <h4>下一步动作</h4>
            <p>{action}</p>
          </div>
        ))}
      </div>

      <div className="page-stack">
        {plan.scenes.map((scene) => (
          <section key={scene.sceneId} className="page-stack">
            <div className="snapshot-card">
              <p className="eyebrow">场次</p>
              <h3>{scene.title}</h3>
              <p>{scene.summary || '暂无场次摘要'}</p>
              <div className="meta-list">
                <span>时长：{formatSeconds(scene.duration)}</span>
                <span>时间：{formatSeconds(scene.startAt)} → {formatSeconds(scene.endAt)}</span>
                <span>情绪：{scene.emotion}</span>
                <span>视频片段：{scene.readyVideoShots}</span>
                <span>图片回退：{scene.imageFallbackShots}</span>
                <span>缺失：{scene.missingVisualShots}</span>
              </div>
              {scene.audioEntry ? (
                <div className="action-row wrap-row compact-row">
                  <span className="tag-chip">场次音轨：{scene.audioEntry.title}</span>
                  {scene.audioEntry.localPath ? (
                    <a className="button-ghost" href={buildLocalMediaPreviewHref(scene.audioEntry.localPath)} target="_blank" rel="noreferrer">打开音轨工件</a>
                  ) : null}
                </div>
              ) : (
                <p>当前场次还没有匹配到音轨。</p>
              )}
            </div>

            <div className="asset-grid">
              {scene.shots.map((shot) => (
                <div key={shot.shotId} className="asset-tile scene-tile">
                  <MediaPreview
                    kind={shot.visualEntry ? getPreviewKindFromGeneratedType(shot.visualEntry.type) : null}
                    title={shot.visualEntry?.title || shot.shotTitle}
                    sourceUrl={shot.visualEntry?.sourceUrl}
                    localPath={shot.visualEntry?.localPath}
                    fallbackLabel={shot.shotTitle}
                  />
                  <span className="label">{getVisualSourceLabel(shot.visualSourceKind)}</span>
                  <h4>{shot.shotTitle}</h4>
                  <p>{shot.visualEntry?.summary || '当前镜头还没有可用视觉产物。'}</p>
                  <div className="meta-list">
                    <span>类型：{shot.kind}</span>
                    <span>时长：{formatSeconds(shot.duration)}</span>
                    <span>时间：{formatSeconds(shot.startAt)} → {formatSeconds(shot.endAt)}</span>
                    <span>情绪：{shot.emotion}</span>
                    {shot.beatType ? <span>节拍：{shot.beatType}</span> : null}
                  </div>
                  {shot.referenceTitles.length > 0 ? (
                    <>
                      <div className="tag-list">
                        {shot.referenceTitles.map((title) => (
                          <span key={`${shot.shotId}-${title}`} className="tag-chip">{title}</span>
                        ))}
                      </div>
                      {shot.referencePromptLine ? <p><strong>定向参考：</strong>{shot.referencePromptLine}</p> : null}
                      {shot.referenceNote ? <p><strong>绑定说明：</strong>{shot.referenceNote}</p> : null}
                    </>
                  ) : null}
                  {shot.warnings.length > 0 ? <p>提醒：{shot.warnings.join(' / ')}</p> : null}
                  <div className="action-row wrap-row compact-row">
                    {shot.visualEntry?.localPath ? (
                      <a className="button-ghost" href={buildLocalMediaPreviewHref(shot.visualEntry.localPath)} target="_blank" rel="noreferrer">打开视觉工件</a>
                    ) : null}
                    {shot.sceneAudioEntry?.localPath ? (
                      <a className="button-ghost" href={buildLocalMediaPreviewHref(shot.sceneAudioEntry.localPath)} target="_blank" rel="noreferrer">打开场次音轨</a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
