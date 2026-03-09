import { AdaptationGenerateButton } from '@/components/adaptation-generate-button';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getLatestProjectWithChapters } from '@/features/adaptation/service';
import { getSyncStatus } from '@/features/sync/service';

function extractReferenceTitle(notes: string | null) {
  return notes?.split('\n').find((line) => line.startsWith('标题：'))?.replace('标题：', '').trim() || '未命名参考';
}

function hasDirectorLanguage(text: string | null) {
  if (!text) return false;
  return text.includes('导演处理上强调') || text.includes('镜头重点放在');
}

function getShotKind(title: string) {
  const kind = title.split(' - ').pop() || title;
  return kind;
}

export async function AdaptationData() {
  const project = await getLatestProjectWithChapters().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">empty</span>
        <h4>暂无可改编项目</h4>
        <p>先去 Idea Lab 和 Chapter Studio 创建项目与章节。</p>
      </div>
    );
  }

  const latestChapter = project.chapters[project.chapters.length - 1];
  const groupedShots = project.scenes.map((scene) => ({
    scene,
    shots: project.shots.filter((shot) => shot.sceneId === scene.id),
  }));
  const references = project.references ?? [];
  const syncStatus = await getSyncStatus(project.id).catch(() => null);
  const directorReadyCount = project.scenes.filter((scene) => hasDirectorLanguage(scene.summary)).length;
  const dynamicShotKinds = Array.from(new Set(project.shots.map((shot) => getShotKind(shot.title))));

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">Adaptation Source</p>
        <h3>{project.title}</h3>
        <p>{latestChapter ? `当前使用章节：${latestChapter.title}` : '当前还没有章节内容可供改编。'}</p>
        <div className="meta-list">
          <span>章节数：{project.chapters.length}</span>
          <span>Scenes：{project.scenes.length}</span>
          <span>Shots：{project.shots.length}</span>
          <span>References：{references.length}</span>
        </div>
        <AdaptationGenerateButton projectId={project.id} />
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">reference influence</span>
          <h4>参考风格注入</h4>
          <p>
            {references.length > 0
              ? '当前改编会读取参考分析中的构图、情绪、动作节奏，并注入 shot 生成。'
              : '当前没有参考分析，改编仍会按基础规则生成。'}
          </p>
        </div>
        <div className="asset-tile">
          <span className="label">latest reference</span>
          <h4>{references[0] ? extractReferenceTitle(references[0].notes) : '暂无参考条目'}</h4>
          <p>{references[0]?.notes?.split('\n').slice(1, 3).join(' / ') || '可去 Reference Lab 录入镜头参考。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">adaptation mode</span>
          <h4>Adaptation v2.4</h4>
          <p>当前分场标题已切换为白名单稳定版：地点词 / 状态词优先，未命中则安全回退为场次编号。</p>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.adaptation} />
        </div>
      ) : null}

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">director-ready</span>
          <h4>导演语言覆盖</h4>
          <p>{directorReadyCount} / {project.scenes.length} 个 scene 已带导演处理描述。</p>
        </div>
        <div className="asset-tile">
          <span className="label">shot taxonomy</span>
          <h4>动态镜头类型</h4>
          <p>{dynamicShotKinds.join(' / ') || '暂无镜头类型'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">output state</span>
          <h4>当前输出状态</h4>
          <p>标题已不再做危险自由拼接，优先保证稳定、可读、可交付。</p>
        </div>
      </div>

      <div className="asset-grid">
        {groupedShots.length === 0 ? (
          <div className="asset-tile">
            <span className="label">empty</span>
            <h4>还没有 scene / shot</h4>
            <p>点击上方按钮，基于最新章节自动生成第一版结构化改编结果。</p>
          </div>
        ) : (
          groupedShots.map(({ scene, shots }) => (
            <div key={scene.id} className="asset-tile scene-tile">
              <span className="label">scene {scene.orderIndex}</span>
              <h4>{scene.title}</h4>
              <p>{scene.summary || '暂无摘要'}</p>
              <div className="meta-list">
                <span>导演语言：{hasDirectorLanguage(scene.summary) ? '已启用' : '基础版'}</span>
                <span>镜头数：{shots.length}</span>
              </div>
              <div className="shot-list">
                {shots.map((shot) => (
                  <div key={shot.id} className="shot-item">
                    <strong>{shot.title}</strong>
                    <span>{shot.cameraNotes || '暂无镜头备注'}</span>
                    <span>{shot.prompt || '暂无镜头提示词'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
