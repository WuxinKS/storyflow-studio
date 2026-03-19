import { ModulePage } from '@/components/module-page';
import { QaPanelData } from '@/components/qa-panel-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function QaPanelPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="质量检查"
      lead="先判断当前能不能交付、最该先修哪里，再按需展开其余检查分组。"
      bullets={[
        '先看阻断项和成熟度',
        '再用快速修复入口处理主问题',
        '最后按需展开其他检查分组',
      ]}
      currentPath="/qa-panel"
      projectId={projectId}
    >
      <QaPanelData projectId={projectId} />
    </ModulePage>
  );
}
