import { AdaptationGenerateButton } from '@/components/adaptation-generate-button';
import { SyncNoticeCard } from '@/components/sync-notice-card';
import { getLatestProjectWithChapters } from '@/features/adaptation/service';
import { isGeneratedNovelChapterTitle, isStoryEngineChapterTitle } from '@/features/story/service';
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

function resolveAdaptationSource(chapters: Array<{ title: string }>) {
  const latestAiChapter = chapters.find((chapter) => isGeneratedNovelChapterTitle(chapter.title));
  if (latestAiChapter) {
    return {
      label: 'AI 小说正文',
      detail: latestAiChapter.title,
    };
  }

  const latestManualChapter = chapters.find((chapter) => !isStoryEngineChapterTitle(chapter.title));
  if (latestManualChapter) {
    return {
      label: '手写 / 普通章节',
      detail: latestManualChapter.title,
    };
  }

  const sceneSeedChapter = chapters.find((chapter) => chapter.title === 'Story Engine Scene Seeds');
  if (sceneSeedChapter) {
    return {
      label: '结构分场种子',
      detail: sceneSeedChapter.title,
    };
  }

  return {
    label: '暂无可用源',
    detail: '请先生成小说或故事结构。',
  };
}

export async function AdaptationData() {
  const project = await getLatestProjectWithChapters().catch(() => null);

  if (!project) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无可改编项目</h4>
        <p>先去创意工坊和章节工作台创建项目与章节。</p>
      </div>
    );
  }

  const adaptationSource = resolveAdaptationSource(project.chapters);
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
        <p className="eyebrow">改编源</p>
        <h3>{project.title}</h3>
        <p>当前改编优先读取小说正文；若还没有正文，再回退到手写章节或 Story Engine 分场种子。</p>
        <div className="meta-list">
          <span>当前源类型：{adaptationSource.label}</span>
          <span>当前源内容：{adaptationSource.detail}</span>
          <span>分场：{project.scenes.length}</span>
          <span>镜头：{project.shots.length}</span>
          <span>参考：{references.length}</span>
        </div>
        <AdaptationGenerateButton projectId={project.id} />
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">参考注入</span>
          <h4>参考风格注入</h4>
          <p>
            {references.length > 0
              ? '当前改编会读取参考分析中的构图、情绪、动作节奏，并注入镜头生成。'
              : '当前没有参考分析，改编仍会按基础规则生成。'}
          </p>
        </div>
        <div className="asset-tile">
          <span className="label">最新参考</span>
          <h4>{references[0] ? extractReferenceTitle(references[0].notes) : '暂无参考条目'}</h4>
          <p>{references[0]?.notes?.split('\n').slice(1, 3).join(' / ') || '可去参考实验室录入镜头参考。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">改编模式</span>
          <h4>改编引擎 v2.5</h4>
          <p>当前已优先从 AI 小说正文出发做自动分镜，让分场和镜头更贴近真实长文本内容，而不只是结构层占位。</p>
        </div>
      </div>

      {syncStatus ? (
        <div className="asset-grid">
          <SyncNoticeCard card={syncStatus.cards.adaptation} />
        </div>
      ) : null}

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">导演语言</span>
          <h4>导演语言覆盖</h4>
          <p>{directorReadyCount} / {project.scenes.length} 个分场已带导演处理描述。</p>
        </div>
        <div className="asset-tile">
          <span className="label">镜头分类</span>
          <h4>动态镜头类型</h4>
          <p>{dynamicShotKinds.join(' / ') || '暂无镜头类型'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">输出状态</span>
          <h4>当前输出状态</h4>
          <p>改编链现在优先吃小说正文，再回退结构种子，更接近“一句话 → 小说 → 分镜”的真实主链。</p>
        </div>
      </div>

      <div className="asset-grid">
        {groupedShots.length === 0 ? (
          <div className="asset-tile">
            <span className="label">空状态</span>
            <h4>还没有分场 / 镜头</h4>
            <p>点击上方按钮，基于当前优先源自动生成第一版结构化改编结果。</p>
          </div>
        ) : (
          groupedShots.map(({ scene, shots }) => (
            <div key={scene.id} className="asset-tile scene-tile">
              <span className="label">第 {scene.orderIndex} 场</span>
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
