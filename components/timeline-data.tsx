import Link from 'next/link';
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
        <p>当前时间线会基于 scene / shot 结构估算镜头时长，先形成节奏预览和影片结构视图。</p>
        <div className="meta-list">
          <span>总时长：{timeline.totalDurationLabel}</span>
          <span>场次数：{timeline.scenes.length}</span>
          <span>镜头数：{timeline.scenes.reduce((sum, scene) => sum + scene.shotCount, 0)}</span>
        </div>
        <div className="action-row">
          <Link href="/storyboard" className="button-ghost">返回分镜板</Link>
          <Link href="/render-studio" className="button-secondary">继续进入生成</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">当前说明</span>
          <h4>时间线 v0</h4>
          <p>当前版本先基于镜头类型估算时长，帮助快速查看每场节奏与全片结构。</p>
        </div>
        <div className="asset-tile">
          <span className="label">当前用途</span>
          <h4>先看结构与节奏</h4>
          <p>让 scene / shot 不只停留在文本拆镜，而是开始转成可读的影片时间结构。</p>
        </div>
        <div className="asset-tile">
          <span className="label">后续方向</span>
          <h4>下一步继续补强</h4>
          <p>后面会继续加情绪曲线、高潮点、节奏异常提示和手动时长修正能力。</p>
        </div>
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
              </div>
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
                    </div>
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
