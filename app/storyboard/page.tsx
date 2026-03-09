import { ModulePage } from '@/components/module-page';
import { StoryboardData } from '@/components/storyboard-data';

export default function StoryboardPage() {
  return (
    <ModulePage
      title="Storyboard"
      lead="在可视化镜头板里查看 scene / shot，并为后续视频生成准备镜头底稿。"
      bullets={[
        '展示由 Adaptation Lab 生成的 scene / shot',
        '用镜头卡片模拟导演视图和分镜板布局',
        '后续可继续补图像参考、镜头变体和提示词编辑',
      ]}
    >
      <StoryboardData />
    </ModulePage>
  );
}
