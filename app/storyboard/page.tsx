import { ModulePage } from '@/components/module-page';
import { StoryboardData } from '@/components/storyboard-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function StoryboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="分镜板"
      lead="在可视化镜头板里查看分场 / 镜头，并为后续视频生成准备导演级镜头底稿。"
      bullets={[
        '展示由改编实验室生成的分场 / 镜头',
        '用镜头卡片模拟导演视图和分镜板布局',
        '后续可继续补图像参考、镜头变体和提示词编辑',
      ]}
      currentPath="/storyboard"
      projectId={projectId}
    >
      <StoryboardData projectId={projectId} />
    </ModulePage>
  );
}
