import { ModulePage } from '@/components/module-page';
import { ReferenceLabData } from '@/components/reference-lab-data';

export default function ReferenceLabPage() {
  return (
    <ModulePage
      title="Reference Lab"
      lead="从截图、样片和参考视频中提炼镜头语言、动作设计与风格约束。"
      bullets={[
        '录入参考镜头的景别、情绪、动作和补充说明',
        '把参考素材转成可复用的风格卡与镜头语言标签',
        '为后续改编实验室 / 分镜板提供迁移依据',
      ]}
    >
      <ReferenceLabData />
    </ModulePage>
  );
}
