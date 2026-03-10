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
      title="角色工作台"
      lead="统一查看主角、对手与关键配角的角色草案，让故事、改编与后续生成共用一套角色认知。"
      bullets={[
        '从故事梗概、剧情节拍和分场种子自动抽取角色草案',
        '先形成主角 / 对手 / 关键配角的基础角色卡',
        '后续继续补强声线、外形稳定锚点与关系网络',
      ]}
      currentPath="/character-studio"
      projectId={projectId}
    >
      <CharacterStudioData projectId={projectId} />
    </ModulePage>
  );
}
