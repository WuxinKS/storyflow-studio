import { ModulePage } from '@/components/module-page';
import { RenderStudioData } from '@/components/render-studio-data';

export default function RenderStudioPage() {
  return (
    <ModulePage
      title="生成工作台"
      lead="从分镜数据出发，组织图像、语音与视频拼装任务，形成可执行、可回写、可导出的生成入口。"
      bullets={[
        '读取分场 / 镜头结果并创建可执行的渲染任务',
        '支持真实 Provider endpoint 接入，并在未配置时自动回退模拟执行',
        '把请求工件、响应工件与生产交付包全部纳入同一条主链',
      ]}
    >
      <RenderStudioData />
    </ModulePage>
  );
}
