import { ModulePage } from '@/components/module-page';
import { RenderStudioData } from '@/components/render-studio-data';

export default function RenderStudioPage() {
  return (
    <ModulePage
      title="Render Studio"
      lead="从 storyboard 数据出发，组织图像、语音与视频拼装任务，形成成片生产入口。"
      bullets={[
        '读取 scene / shot 结果并生成 render job 占位',
        '为后续真实图像、视频、配音 provider 接入预留结构',
        '让主链闭环到真正的 production 准备阶段',
      ]}
    >
      <RenderStudioData />
    </ModulePage>
  );
}
