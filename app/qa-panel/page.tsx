import { ModulePage } from '@/components/module-page';
import { QaPanelData } from '@/components/qa-panel-data';

export default function QaPanelPage() {
  return (
    <ModulePage
      title="质量检查"
      lead="对当前一句话成片主链做交付前质检，检查结构、同步状态、渲染任务与导出闭环是否真正可交付。"
      bullets={[
        '检查是否稳定为 5 场 / 20 镜头 / 每场 4 镜头',
        '检查上下游链路是否过期，并标出阻断交付项',
        '检查角色命名、视觉圣经、渲染任务与导出链是否接通',
      ]}
    >
      <QaPanelData />
    </ModulePage>
  );
}
