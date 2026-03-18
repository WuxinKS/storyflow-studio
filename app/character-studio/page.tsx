import { ModulePage } from '@/components/module-page';
import { CharacterStudioData } from '@/components/character-studio-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function CharacterStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="角色与视觉"
      lead="这一页先把人物认知和视觉方向统一好，让后面的自动分镜、图片生成和视频生成都吃同一套设定。"
      bullets={[
        '先生成并锁定主角、对手和关键配角',
        '再确认角色外形锚点是否已经接上视觉规则',
        '稳定后直接进入自动分镜，不再来回返工',
      ]}
      currentPath="/character-studio"
      projectId={projectId}
    >
      <CharacterStudioData projectId={projectId} />
    </ModulePage>
  );
}
