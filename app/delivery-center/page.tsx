import { DeliveryCenterData } from '@/components/delivery-center-data';
import { ModulePage } from '@/components/module-page';
import { normalizeProjectId } from '@/lib/project-links';

export default async function DeliveryCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="交付中心"
      lead="这一页只负责收最后结果：先确认最新交付包能不能用，再按需查看历史版本和完整工件。"
      bullets={[
        '默认只看最新交付包，不把整页变成档案仓库',
        '需要时再展开历史交付包和完整工件入口',
        '支持重新导出当前交付包，并快速回跳到成片预演或生成工作台',
      ]}
      currentPath="/delivery-center"
      projectId={projectId}
    >
      <DeliveryCenterData projectId={projectId} />
    </ModulePage>
  );
}
