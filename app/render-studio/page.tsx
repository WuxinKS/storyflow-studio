import { ModulePage } from '@/components/module-page';
import { RenderStudioData } from '@/components/render-studio-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function RenderStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="生成工作台"
      lead="从分镜数据出发，组织图像、语音与视频拼装任务，并把执行结果回写成真正可追溯的媒体索引。"
      bullets={[
        '读取分场 / 镜头结果并创建可执行的渲染任务',
        '支持真实 Provider endpoint 接入，并在未配置时自动回退模拟执行',
        '把请求工件、响应工件、媒体索引与生产交付包全部纳入同一条主链',
      ]}
      currentPath="/render-studio"
      projectId={projectId}
    >
      <RenderStudioData projectId={projectId} />
    </ModulePage>
  );
}
