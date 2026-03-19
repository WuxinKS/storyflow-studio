import { IdeaLabForm } from '@/components/idea-lab-form';
import { ModulePage } from '@/components/module-page';

export default function IdeaLabPage() {
  return (
    <ModulePage
      title="创意工坊"
      lead="这一页只负责启动项目：先说清一句话创意，再决定是直接跑完整主链，还是先建项目逐步推进。"
      bullets={[
        '优先补齐项目标题和一句话创意，再决定启动方式',
        '方向明确时直接一键跑到小说、分镜、图片、视频与预演',
        '还在试方向时先创建项目，后续每一页只做当前这一步',
      ]}
      currentPath="/idea-lab"
    >
        <IdeaLabForm />
    </ModulePage>
  );
}
