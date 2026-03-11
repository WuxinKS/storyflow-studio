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
      lead="集中回看每次生产导出生成的 manifest、provider payload、媒体索引与 zip 归档，让一句话成片链路真正具备交付可追溯性。"
      bullets={[
        '按项目查看最近导出的 production bundle 与 zip 归档',
        '直接打开 manifest、provider payload、媒体索引和 preset JSON',
        '结合 QA 与生成工作台，快速回到需要补修的链路位置',
      ]}
      currentPath="/delivery-center"
      projectId={projectId}
    >
      <DeliveryCenterData projectId={projectId} />
    </ModulePage>
  );
}
