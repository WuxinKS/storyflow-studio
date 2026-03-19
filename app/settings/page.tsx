import { ModulePage } from '@/components/module-page';
import { SettingsData } from '@/components/settings-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="设置中心"
      lead="先确认 LLM 和 Provider 是否真实接通，再决定继续补配置，还是回项目里做联调验证。"
      bullets={[
        '先看 LLM 是否在线',
        '再看图像 / 语音 / 视频 Provider 是否可用',
        '最后带着项目去渲染和质检验证',
      ]}
      currentPath="/settings"
      projectId={projectId}
    >
      <SettingsData projectId={projectId} />
    </ModulePage>
  );
}
