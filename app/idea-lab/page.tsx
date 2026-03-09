import { IdeaLabForm } from '@/components/idea-lab-form';
import { SectionCard } from '@/components/section-card';

export default function IdeaLabPage() {
  return (
    <div className="page-stack">
      <SectionCard
        title="Idea Lab"
        description="输入一句创意、关键词、题材和输出目标，初始化一个可持续迭代的故事项目。"
      >
        <IdeaLabForm />
      </SectionCard>
    </div>
  );
}
