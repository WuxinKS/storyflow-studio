import { ModulePage } from '@/components/module-page';
import { VisualBibleData } from '@/components/visual-bible-data';

export default function VisualBiblePage() {
  return (
    <ModulePage
      title="视觉圣经"
      lead="把故事、角色和参考分析统一抽成一套视觉总控，确保后续改编、分镜与生成都围绕同一种影像语言运作。"
      bullets={[
        '自动生成风格名、整体气质、色彩与光线策略',
        '抽取镜头语言、运动规则与材质关键词',
        '为后续改编实验室、分镜板与生成工作台提供统一视觉约束',
      ]}
    >
      <VisualBibleData />
    </ModulePage>
  );
}
