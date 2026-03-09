import { ModulePage } from '@/components/module-page';
import { AssetsData } from '@/components/assets-data';

export default function AssetsPage() {
  return (
    <ModulePage
      title="资产中心"
      lead="统一整理角色、风格、场景、参考资产与生成产物，让一句话成片链路开始拥有真正可复用的素材库。"
      bullets={[
        '统一查看角色、场景、道具、风格板、参考图与生成媒体资产',
        '支持手动录入资产并关联角色 / 场景 / 镜头',
        '把渲染后的图片 / 音频 / 视频继续沉淀回资产层',
      ]}
    >
      <AssetsData />
    </ModulePage>
  );
}
