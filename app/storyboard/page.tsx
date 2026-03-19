import { ModulePage } from '@/components/module-page';
import { StoryboardData } from '@/components/storyboard-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function StoryboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="分镜板"
      lead="这一页是自动分镜后的精修台：先看关键场次是否成立，再按需细修镜头、参考和最新产物。"
      bullets={[
        '默认只看最关键的场次和镜头，不把整页变成长文本',
        '需要时再展开完整镜头卡、参考绑定和媒体结果',
        '精修完成后，注意力回到主流程里的生成工作台',
      ]}
      currentPath="/storyboard"
      projectId={projectId}
    >
      <StoryboardData projectId={projectId} />
    </ModulePage>
  );
}
