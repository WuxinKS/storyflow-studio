import { SectionCard } from '@/components/section-card';
import { StorySetupData } from '@/components/story-setup-data';

export default function StorySetupPage() {
  return (
    <div className="page-stack">
      <SectionCard
        title="Story Setup"
        description="统一管理世界观、角色、组织与故事骨架，让写作与影视生成共用一套故事资产。"
      >
        <StorySetupData />
      </SectionCard>
    </div>
  );
}
