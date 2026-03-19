import { ModulePage } from '@/components/module-page';
import { AssetsData } from '@/components/assets-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="资产中心"
      lead="先看资产链缺口，再决定补录、补参考，还是继续把生成结果回流进资产库。"
      bullets={[
        '先看基础资产、参考输入和生成产物',
        '按需补录手动资产并挂接角色 / 场景 / 镜头',
        '需要时再打开完整资产库搜索与筛选',
      ]}
      currentPath="/assets"
      projectId={projectId}
    >
      <AssetsData projectId={projectId} />
    </ModulePage>
  );
}
