import Link from 'next/link';
import { AdaptationData } from '@/components/adaptation-data';
import { ModulePage } from '@/components/module-page';

export default async function AdaptationLabPage() {
  return (
    <ModulePage
      title="Adaptation Lab"
      lead="把小说、文章或剧本母本转为 scene / shot 级的结构化镜头规划。"
      bullets={[
        '基于最新章节生成导演语言增强版 scene / shot 结构',
        '让输出可直接流向 Storyboard 和视频生成主链',
        '当前已支持参考素材注入 + 动态镜头类型生成',
      ]}
    >
      <AdaptationData />
      <div className="action-row">
        <Link href="/chapter-studio" className="button-ghost">返回章节工作台</Link>
        <Link href="/storyboard" className="button-secondary">前往 Storyboard</Link>
      </div>
    </ModulePage>
  );
}
