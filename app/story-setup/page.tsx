import { ProjectContextBar } from '@/components/project-context-bar';
import { SectionCard } from '@/components/section-card';
import { StorySetupData } from '@/components/story-setup-data';
import { normalizeProjectId } from '@/lib/project-links';

export default async function StorySetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string | string[] }>;
}) {
  const projectId = normalizeProjectId((await searchParams)?.projectId);

  return (
    <div className="page-stack">
      <SectionCard
        title="故事设定"
        description="统一管理世界观、角色、组织与故事骨架，让写作与影视生成共用一套故事资产。"
      >
        <ProjectContextBar currentPath="/story-setup" projectId={projectId} />
        <StorySetupData projectId={projectId} />
      </SectionCard>
    </div>
  );
}
