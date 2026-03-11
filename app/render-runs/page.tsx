import { ModulePage } from '@/components/module-page';
import { RenderRunCenterData } from '@/components/render-run-center-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function RenderRunsPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="运行诊断台"
      lead="集中回看每次图像、语音、视频 Provider 的请求工件、响应工件和定向参考注入情况，方便把一句话到成片的执行链真正调通。"
      bullets={[
        '读取 exports/render-runs 下的每次执行目录与 request / response JSON',
        '自动关联渲染任务状态、媒体索引和当前项目上下文',
        '直接暴露带参考载荷、定向参考载荷与调试入口，便于排障联调',
      ]}
      currentPath="/render-runs"
      projectId={projectId}
    >
      <RenderRunCenterData projectId={projectId} />
    </ModulePage>
  );
}
