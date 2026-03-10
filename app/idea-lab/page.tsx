import { IdeaLabForm } from '@/components/idea-lab-form';
import { SectionCard } from '@/components/section-card';

export default function IdeaLabPage() {
  return (
    <div className="page-stack">
      <SectionCard
        title="创意工坊"
        description="输入一句创意、关键词、题材和输出目标；既可以只创建项目，也可以直接一键跑完整主链。"
      >
        <IdeaLabForm />
      </SectionCard>
    </div>
  );
}
