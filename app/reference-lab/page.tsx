import { ModulePage } from '@/components/module-page';
import { ReferenceLabData } from '@/components/reference-lab-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function ReferenceLabPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="参考工作台"
      lead="把截图、样片和参考视频拆成可复用的风格卡与定向约束，直接服务改编、分镜、图片生成和视频生成。"
      bullets={[
        '录入参考镜头的构图、情绪、节奏和补充说明',
        '形成项目级参考画像，并支持把参考定向绑定到分场 / 镜头',
        '为后续改编实验室、分镜板和生成工作台提供稳定参考约束',
      ]}
      currentPath="/reference-lab"
      projectId={projectId}
    >
      <ReferenceLabData projectId={projectId} />
    </ModulePage>
  );
}
