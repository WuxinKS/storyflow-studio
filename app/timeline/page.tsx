import { ModulePage } from '@/components/module-page';
import { TimelineData } from '@/components/timeline-data';

export default function TimelinePage() {
  return (
    <ModulePage
      title="时间线"
      lead="把分场 / 镜头结构转成可调的影片节奏视图，支持手动修时、情绪曲线与高潮标记。"
      bullets={[
        '基于镜头类型估算时长，并支持手动微调',
        '查看每场起止时间、镜头数量、情绪强度与峰值分布',
        '自动提示节奏异常，辅助继续进入生成与交付检查',
      ]}
    >
      <TimelineData />
    </ModulePage>
  );
}
