import { ChapterStudioData } from '@/components/chapter-studio-data';
import { SectionCard } from '@/components/section-card';

export default function ChapterStudioPage() {
  return (
    <div className="page-stack">
      <SectionCard
        title="Chapter Studio"
        description="承接长文本创作能力，先打通真实项目与章节草稿的读写链路。"
      >
        <ChapterStudioData />
      </SectionCard>
    </div>
  );
}
