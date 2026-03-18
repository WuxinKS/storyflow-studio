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
      title="改编实验室"
      lead="把小说、文章或剧本母本转为 scene / shot 级的结构化镜头规划。"
      bullets={[
        '基于最新章节生成导演语言增强版 scene / shot 结构',
        '让输出可直接流向分镜板和视频生成主链',
        '当前已支持参考素材注入 + 动态镜头类型生成',
      ]}
      currentPath="/adaptation-lab"
      projectId={projectId}
    >
      <AdaptationData projectId={projectId} />
    </ModulePage>
  );
}
