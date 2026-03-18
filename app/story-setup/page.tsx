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
      lead="这一页只做一件事：把故事包补齐，让梗概、节拍、分场和正文能稳定交给下游。"
      bullets={[
        '先确定当前缺的是梗概、节拍、分场，还是 AI 正文',
        '默认只做当前这一步，不再一次性堆所有故事操作',
        '故事包补齐后，直接交给角色与视觉继续推进',
      ]}
      currentPath="/story-setup"
      projectId={projectId}
    >
      <StorySetupData projectId={projectId} />
    </ModulePage>
  );
}
