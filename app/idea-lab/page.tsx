import { IdeaLabForm } from '@/components/idea-lab-form';
import { ModulePage } from '@/components/module-page';

export default function IdeaLabPage() {
  return (
    <ModulePage
      title="创意工坊"
      lead="先把一句话创意说清楚，再决定是只创建项目，还是直接触发完整主链。"
      bullets={[
        '先定义项目标题、题材、风格和目标输出',
        '如果方向明确，直接一键跑完整主链',
        '如果还在探索阶段，就先保存项目再继续迭代',
      ]}
      currentPath="/idea-lab"
    >
        <IdeaLabForm />
    </ModulePage>
  );
}
