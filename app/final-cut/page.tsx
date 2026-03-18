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
      lead="先判断 final cut 能不能拼，再按时间线核对镜头来源、图片回退和场次音轨，让从一句话到成片的最后一段真正可执行、可复核。"
      bullets={[
        '先把阻塞项、推荐动作和拼装路线放到页面最前面',
        '按真实成片顺序展示每个镜头最终采用的视频、图片回退和音轨状态',
        '让场次总览、详细装配卡和交付入口形成一条完整的最后一公里链路',
      ]}
      currentPath="/final-cut"
      projectId={projectId}
    >
      <FinalCutData projectId={projectId} />
    </ModulePage>
  );
}
