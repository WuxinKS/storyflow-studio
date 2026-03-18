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
      lead="这一页先判断能不能拼，再决定是回去补素材、先拼预演版，还是直接进入交付中心。"
      bullets={[
        '默认先看阻塞项、推荐动作和场次总览，不把装配细节一次性铺开',
        '需要时再展开镜头顺序预演和场次装配细节',
        '能拼时直接交给交付中心，不能拼就明确回到生成工作台补齐',
      ]}
      currentPath="/final-cut"
      projectId={projectId}
    >
      <FinalCutData projectId={projectId} />
    </ModulePage>
  );
}
