import Link from 'next/link';
import { TimelineEditor } from '@/components/timeline-editor';
import { getTimelineBundle } from '@/features/timeline/service';

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}分 ${remain}秒`;
}

export async function TimelineData() {
  const timeline = await getTimelineBundle().catch(() => null);

  if (!timeline) {
    return (
      <div className="asset-tile">
        <span className="label">empty</span>
        <h4>暂无时间线数据</h4>
        <p>请先生成改编与分镜结果，再回来查看节奏结构。</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">时间线总览</p>
        <h3>{timeline.projectTitle}</h3>
        <p>当前时间线已经支持手动修时、情绪曲线和高潮标记，不再只是静态估时，而是能直接服务于节奏调校。</p>
        <div className="meta-list">
          <span>总时长：{timeline.totalDurationLabel}</span>
          <span>场次数：{timeline.scenes.length}</span>
          <span>镜头数：{timeline.scenes.reduce((sum, scene) => sum + scene.shotCount, 0)}</span>
          <span>异常提示：{timeline.warnings.filter((item) => item.level === 'warning').length}</span>
        </div>
        <div className="action-row">
          <Link href="/storyboard" className="button-ghost">返回分镜板</Link>
          <Link href="/render-studio" className="button-secondary">继续进入生成</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">当前说明</span>
          <h4>时间线 v1</h4>
          <p>当前版本已支持镜头时长微调、情绪强度估算、高潮点标记与节奏异常提示。</p>
        </div>
        <div className="asset-tile">
          <span className="label">情绪曲线</span>
          <h4>场次情绪走势</h4>
          <p>{timeline.emotionCurve.map((item) => `${item.title}:${item.score}`).join(' / ')}</p>
        </div>
        <div className="asset-tile">
          <span className="label">节奏提示</span>
          <h4>自动发现的问题</h4>
          <p>{timeline.warnings.map((item) => item.label).join(' / ') || '当前没有明显节奏异常。'}</p>
        </div>
      </div>

      <TimelineEditor projectId={timeline.projectId} scenes={timeline.scenes} />

      <div className="asset-grid">
        {timeline.warnings.length === 0 ? (
          <div className="asset-tile">
            <span className="label">pace status</span>
            <h4>节奏状态稳定</h4>
            <p>当前没有发现明显时长异常或峰值缺口，可以继续进入渲染与交付检查。</p>
          </div>
        ) : (
          timeline.warnings.map((warning, index) => (
            <div key={`${warning.label}-${index}`} className="asset-tile">
              <span className="label">{warning.level === 'warning' ? 'warning' : 'info'}</span>
              <h4>{warning.label}</h4>
              <p>{warning.detail}</p>
            </div>
          ))
        )}
      </div>

      <div className="storyboard-grid">
        {timeline.scenes.map((scene) => (
          <section key={scene.id} className="storyboard-column">
            <div className="storyboard-column-head">
              <span className="label">scene</span>
              <h4>{scene.title}</h4>
              <p>{scene.summary || '暂无场景摘要'}</p>
              <div className="meta-list">
                <span>时长：{formatSeconds(scene.duration)}</span>
                <span>起止：{formatSeconds(scene.startAt)} → {formatSeconds(scene.endAt)}</span>
                <span>镜头数：{scene.shotCount}</span>
                <span>情绪：{scene.emotionScore} / {scene.emotionLabel}</span>
              </div>
              {scene.beatMarkers.length > 0 ? <p>标记：{scene.beatMarkers.join(' / ')}</p> : null}
            </div>
            <div className="storyboard-cards">
              {scene.shots.map((shot) => (
                <article key={shot.id} className="frame-card">
                  <div className="frame-body">
                    <strong>{shot.title}</strong>
                    <div className="meta-list">
                      <span>类型：{shot.kind}</span>
                      <span>时长：{formatSeconds(shot.duration)}</span>
                      <span>时间：{formatSeconds(shot.startAt)} → {formatSeconds(shot.endAt)}</span>
                      <span>情绪：{shot.emotion} / {shot.emotionLabel}</span>
                    </div>
                    <p>{shot.beatType ? `节奏标记：${shot.beatType}` : '尚未手动标记节奏节点。'}</p>
                    {shot.note ? <p>备注：{shot.note}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
