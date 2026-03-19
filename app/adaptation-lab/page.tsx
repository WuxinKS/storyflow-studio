import { AdaptationData } from '@/components/adaptation-data';
import { ModulePage } from '@/components/module-page';
import { normalizeProjectId } from '@/lib/project-links';

export default async function AdaptationLabPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="自动分镜"
      lead="这一页只负责把正文拆成 scene / shot，先判断能不能继续，再决定是否进入逐镜头精修。"
      bullets={[
        '优先确认有没有可改编正文，再生成首版自动分镜',
        '默认只看关键场次是否成立，完整镜头细节按需展开',
        '能继续时进入分镜板精修，不能继续就明确回补上游输入',
      ]}
      currentPath="/adaptation-lab"
      projectId={projectId}
    >
      <AdaptationData projectId={projectId} />
    </ModulePage>
  );
}
