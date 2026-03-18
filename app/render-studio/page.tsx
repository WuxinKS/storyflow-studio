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
      lead="把上游镜头约束、模型供应商、执行队列和产物回流放进一条清晰操作链里，让我们知道现在该补输入、盯任务，还是直接推进成片。"
      bullets={[
        '先确认镜头是否具备生成条件，再分别查看图片 / 语音 / 视频三条供应商通道',
        '把执行中、排队中、失败和已完成任务拆开看，减少长列表堆叠',
        '让请求工件、响应工件、媒体索引和成片交接入口都顺着同一条主链往下走',
      ]}
      currentPath="/render-studio"
      projectId={projectId}
    >
      <RenderStudioData projectId={projectId} />
    </ModulePage>
  );
}
