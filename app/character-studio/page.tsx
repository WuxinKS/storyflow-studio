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
      lead="这一页先统一人物认知和视觉方向，让后面的自动分镜、图片生成和视频生成都围绕同一套角色设定。"
      bullets={[
        '先锁定主角、对手和关键配角，不让下游再猜人物',
        '默认只看关键角色卡，完整角色库和定稿台按需展开',
        '角色与视觉稳定后，直接交给自动分镜继续推进',
      ]}
      currentPath="/character-studio"
      projectId={projectId}
    >
      <CharacterStudioData projectId={projectId} />
    </ModulePage>
  );
}
