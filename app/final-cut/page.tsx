import { FinalCutData } from '@/components/final-cut-data';
import { ModulePage } from '@/components/module-page';
import { normalizeProjectId } from '@/lib/project-links';

export default async function FinalCutPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="成片预演"
      lead="基于时间线顺序、镜头产物与场次音轨，自动拼出一份可复核的 final cut 计划，让从一句话到成片的最后一段真正有据可查。"
      bullets={[
        '优先选取镜头视频片段，缺失时自动回退图片结果',
        '按场次匹配音轨，并标出缺失音轨和缺失视觉产物',
        '把镜头顺序、定向参考和工件入口汇总成一份成片预演面板',
      ]}
      currentPath="/final-cut"
      projectId={projectId}
    >
      <FinalCutData projectId={projectId} />
    </ModulePage>
  );
}
