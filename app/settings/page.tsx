import { ModulePage } from '@/components/module-page';
import { SettingsData } from '@/components/settings-data';

export default function SettingsPage() {
  return (
    <ModulePage
      title="设置中心"
      lead="统一查看模型、Provider、导出目录与当前执行策略，确保演示环境与真实执行环境都可控。"
      bullets={[
        '查看默认模型、LLM endpoint 与 API Key 是否已接通',
        '查看图像 / 语音 / 视频 Provider 当前是否走真实执行还是模拟执行',
        '查看导出目录、联调建议与最新项目链路概况',
      ]}
    >
      <SettingsData />
    </ModulePage>
  );
}
