import { ChapterStudioData } from '@/components/chapter-studio-data';
import { ProjectContextBar } from '@/components/project-context-bar';
import { SectionCard } from '@/components/section-card';
import { normalizeProjectId } from '@/lib/project-links';

export default async function ChapterStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <div className="page-stack">
      <SectionCard
        title="章节工作台"
        description="承接长文本创作能力，先打通真实项目与章节草稿的读写链路。"
      >
        <ProjectContextBar currentPath="/chapter-studio" projectId={projectId} />
        <ChapterStudioData projectId={projectId} />
      </SectionCard>
    </div>
  );
}
