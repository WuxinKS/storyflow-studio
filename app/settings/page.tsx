import { ModulePage } from '@/components/module-page';

export default function SettingsPage() {
  return (
    <ModulePage
      title="Settings"
      lead="统一管理模型、provider、渲染策略、风格模板与项目偏好。"
      bullets={[
        'AI 模型与 API provider 配置',
        '故事生成 / 图像生成 / 视频生成策略',
        '后续将接入成本控制与项目级预设',
      ]}
    />
  );
}
