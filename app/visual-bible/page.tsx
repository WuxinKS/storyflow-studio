import { ModulePage } from '@/components/module-page';
import { VisualBibleData } from '@/components/visual-bible-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function VisualBiblePage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="视觉圣经"
      lead="把故事、角色与参考画像压缩成一套统一视觉总控，让改编、分镜、图片生成和视频生成都吃同一套影像规则。"
      bullets={[
        '自动生成风格名、整体气质、色彩与光线策略',
        '支持人工修订、关键字段锁定和局部重生',
        '为后续改编实验室、分镜板与生成工作台提供统一视觉约束',
      ]}
      currentPath="/visual-bible"
      projectId={projectId}
    >
      <VisualBibleData projectId={projectId} />
    </ModulePage>
  );
}
