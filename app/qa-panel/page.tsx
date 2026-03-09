import { ModulePage } from '@/components/module-page';
import { QaPanelData } from '@/components/qa-panel-data';

export default function QaPanelPage() {
  return (
    <ModulePage
      title="质量检查"
      lead="对当前一句话成片主链做快速质检，先检查结构、分类、角色命名、视觉总控与渲染任务状态。"
      bullets={[
        '检查是否稳定为 5 场 / 20 镜头 / 每场 4 镜头',
        '检查镜头类型是否收敛到正式分类体系',
        '检查角色命名、视觉圣经与渲染任务链是否接通',
      ]}
    >
      <QaPanelData />
    </ModulePage>
  );
}
