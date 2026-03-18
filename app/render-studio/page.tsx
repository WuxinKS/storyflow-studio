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
      lead="这一页只负责推进生成：先确认能不能生成，再盯队列、看产物，最后把结果交给成片预演。"
      bullets={[
        '先决定当前是补输入、创建任务、跑任务，还是直接交给成片预演',
        '默认只看供应商状态、最新产物和任务队列，高级联调内容折叠起来',
        '当视频结果出现后，直接进入成片预演，不再来回找入口',
      ]}
      currentPath="/render-studio"
      projectId={projectId}
    >
      <RenderStudioData projectId={projectId} />
    </ModulePage>
  );
}
