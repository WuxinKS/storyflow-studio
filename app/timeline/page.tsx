import { ModulePage } from '@/components/module-page';
import { TimelineData } from '@/components/timeline-data';

export default function TimelinePage() {
  return (
    <ModulePage
      title="时间线"
      lead="把 scene / shot 结构转成可读的影片节奏视图，先建立整片时长、分场时长和镜头排序的基础时间线。"
      bullets={[
        '基于镜头类型估算时长，形成全片节奏总览',
        '查看每场起止时间、镜头数量与时长分布',
        '为后续情绪曲线、节奏异常提示与手动修时打基础',
      ]}
    >
      <TimelineData />
    </ModulePage>
  );
}
