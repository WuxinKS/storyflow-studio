import { getQaCheckToneLabel } from '@/lib/display';
import { getQaReport } from '@/features/qa/service';

const GROUP_LABELS = {
  structure: '结构检查',
  content: '内容检查',
  sync: '同步检查',
  render: '渲染检查',
  export: '交付检查',
} as const;

export async function QaPanelData() {
  const report = await getQaReport().catch(() => null);

  if (!report) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无质量检查数据</h4>
        <p>请先生成故事、改编与渲染数据，再回来查看质量检查结果。</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">质量总览</p>
        <h3>{report.projectTitle}</h3>
        <p>这里会对当前主链做发布前检查，除了结构和导出是否通，还会判断链路是否过期，并给出成熟度等级和阻断交付项。</p>
        <div className="meta-list">
          <span>通过：{report.summary.passed}</span>
          <span>失败：{report.summary.failed}</span>
          <span>阻断项：{report.summary.blockerCount}</span>
          <span>等级：{report.summary.maturity}</span>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">交付状态</span>
          <h4>{report.summary.readyToDeliver ? '可交付' : report.summary.maturity}</h4>
          <p>
            {report.summary.readyToDeliver
              ? '当前所有质量检查均已通过，可以把这条主链视为可交付状态。'
              : `当前还有 ${report.summary.failed} 项未通过，其中 ${report.summary.blockerCount} 项会阻断交付。`}
          </p>
        </div>
        <div className="asset-tile">
          <span className="label">阻断项</span>
          <h4>阻断交付项</h4>
          <p>{report.summary.blockerLabels.join(' / ') || '当前没有阻断项。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">最新交付包</span>
          <h4>最新交付包</h4>
          <p>{report.summary.bundleDir || '当前还没有成功写盘的交付包目录。'}</p>
          <p>{report.summary.zipPath || '当前还没有 zip 文件。'}</p>
        </div>
      </div>

      {Object.entries(report.groupedChecks).map(([group, checks]) => (
        <div key={group} className="page-stack">
          <div className="snapshot-card">
            <p className="eyebrow">{GROUP_LABELS[group as keyof typeof GROUP_LABELS]}</p>
            <h3>{GROUP_LABELS[group as keyof typeof GROUP_LABELS]}</h3>
            <p>该分组下共 {checks.length} 项检查，帮助更快定位当前主链还差哪一段没有闭环。</p>
          </div>
          <div className="asset-grid three-up">
            {checks.map((check) => (
              <div key={check.key} className="asset-tile">
                <span className="label">{getQaCheckToneLabel(check.passed ? 'pass' : check.blocksDelivery ? 'blocker' : 'warning')}</span>
                <h4>{check.label}</h4>
                <p>{check.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
