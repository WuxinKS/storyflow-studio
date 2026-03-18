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
      lead="把主角、对手与关键配角定成可锁定、可局部重生的角色系统，让故事、改编和生成环节始终吃同一套人物设定。"
      bullets={[
        '从故事梗概、剧情节拍和分场种子自动抽取角色草案',
        '支持角色名、定位、原型、目标与冲突的锁定保护',
        '继续补强声线、外形稳定锚点与关系网络',
      ]}
      currentPath="/character-studio"
      projectId={projectId}
    >
      <CharacterStudioData projectId={projectId} />
    </ModulePage>
  );
}
