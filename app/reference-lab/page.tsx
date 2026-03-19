import { ModulePage } from '@/components/module-page';
import { ReferenceLabData } from '@/components/reference-lab-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function ReferenceLabPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="参考工作台"
      lead="这一页只做参考约束：先录入参考卡，再按需绑定到关键场次或镜头，不把整页变成资料仓库。"
      bullets={[
        '先判断当前该录入新参考，还是先做关键镜头绑定',
        '默认只看参考画像和主任务，完整卡库按需展开',
        '参考稳定后，把注意力交回分镜板和生成工作台',
      ]}
      currentPath="/reference-lab"
      projectId={projectId}
    >
      <ReferenceLabData projectId={projectId} />
    </ModulePage>
  );
}
