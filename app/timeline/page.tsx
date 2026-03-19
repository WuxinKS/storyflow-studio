import { ModulePage } from '@/components/module-page';
import { TimelineData } from '@/components/timeline-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function TimelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="时间线"
      lead="这一页只负责节奏：先判断有没有异常，再决定是否打开修订台，或回到生成工作台继续推进。"
      bullets={[
        '默认先看时长异常、情绪曲线和建议动作',
        '需要时再打开节奏修订台做手动修时与峰值标记',
        '时间线稳定后，把注意力交回生成、预演和交付链路',
      ]}
      currentPath="/timeline"
      projectId={projectId}
    >
      <TimelineData projectId={projectId} />
    </ModulePage>
  );
}
