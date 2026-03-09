import { ModulePage } from '@/components/module-page';
import { AssetsData } from '@/components/assets-data';

export default function AssetsPage() {
  return (
    <ModulePage
      title="资产中心"
      lead="统一整理角色、风格、场景与参考资产，让一句话成片链路开始拥有真正可复用的素材入口。"
      bullets={[
        '聚合角色草案、视觉圣经、分场摘要与参考分析',
        '先形成可浏览、可复用的资产卡入口',
        '为后续资产关联、手动录入与渲染复用打基础',
      ]}
    >
      <AssetsData />
    </ModulePage>
  );
}
