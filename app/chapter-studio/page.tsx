import { ChapterStudioData } from '@/components/chapter-studio-data';
import { ModulePage } from '@/components/module-page';
import { normalizeProjectId } from '@/lib/project-links';

export default async function ChapterStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <ModulePage
      title="章节工作台"
      lead="把故事骨架扩展成长文本正文，让后续改编真正建立在小说内容之上，而不是只靠摘要。"
      bullets={[
        '先检查当前项目的故事骨架是否已经稳定',
        '把章节正文作为改编和分镜的真实上游输入',
        '保留手动精修入口，避免正文被完全自动化覆盖',
      ]}
      currentPath="/chapter-studio"
      projectId={projectId}
    >
      <ChapterStudioData projectId={projectId} />
    </ModulePage>
  );
}
