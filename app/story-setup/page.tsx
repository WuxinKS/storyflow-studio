import { ModulePage } from '@/components/module-page';
import { StorySetupData } from '@/components/story-setup-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function StorySetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="故事设定"
      lead="先稳定 premise、梗概、节拍和分场基础，后面的角色、视觉、改编和生成才不会反复返工。"
      bullets={[
        '先看故事前提和阶段状态，确认项目方向没有跑偏',
        '稳定 synopsis、beat sheet 和 scene seeds 三层骨架',
        '把改动影响往下游传递，避免角色与生成链路失真',
      ]}
      currentPath="/story-setup"
      projectId={projectId}
    >
      <StorySetupData projectId={projectId} />
    </ModulePage>
  );
}
