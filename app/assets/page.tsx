import { ModulePage } from '@/components/module-page';
import { AssetsData } from '@/components/assets-data';

export default function AssetsPage() {
  return (
    <ModulePage
      title="资产中心"
      lead="统一整理角色、风格、场景与参考资产，让一句话成片链路开始拥有真正可复用的素材入口。"
      bullets={[
        '统一查看角色、场景、道具、风格板与参考图资产',
        '支持手动录入资产并关联角色 / 场景 / 镜头',
        '为 Render 与导出链提供可追溯的资产来源信息',
      ]}
    >
      <AssetsData />
    </ModulePage>
  );
}
