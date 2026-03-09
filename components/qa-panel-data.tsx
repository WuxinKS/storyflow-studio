import { getQaReport } from '@/features/qa/service';

export async function QaPanelData() {
  const report = await getQaReport().catch(() => null);

  if (!report) {
    return (
      <div className="asset-tile">
        <span className="label">empty</span>
        <h4>暂无 QA 数据</h4>
        <p>请先生成故事、改编与渲染数据，再回来查看质量检查结果。</p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">QA Overview</p>
        <h3>{report.projectTitle}</h3>
        <p>这里会对当前主链进行轻量质检，优先检查结构稳定性、镜头分类、角色命名、视觉总控和导出交付是否接通。</p>
        <div className="meta-list">
          <span>通过：{report.summary.passed}</span>
          <span>失败：{report.summary.failed}</span>
          <span>总项：{report.summary.total}</span>
          <span>项目 ID：{report.projectId}</span>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">release status</span>
          <h4>{report.summary.readyToDeliver ? '可交付' : '暂不可交付'}</h4>
          <p>
            {report.summary.readyToDeliver
              ? '当前所有 QA 检查均已通过，可以把这条主链视为可交付状态。'
              : `还有 ${report.summary.failed} 项未通过，建议先修完再继续往外发包。`}
          </p>
        </div>
        <div className="asset-tile">
          <span className="label">failed items</span>
          <h4>未通过项汇总</h4>
          <p>{report.summary.failedLabels.join(' / ') || '当前没有失败项。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">latest bundle</span>
          <h4>最新交付包</h4>
          <p>{report.summary.bundleDir || '当前还没有成功写盘的 bundle。'}</p>
          <p>{report.summary.zipPath || '当前还没有 zip。'}</p>
        </div>
      </div>

      <div className="asset-grid three-up">
        {report.checks.map((check) => (
          <div key={check.key} className="asset-tile">
            <span className="label">{check.passed ? 'pass' : 'check'}</span>
            <h4>{check.label}</h4>
            <p>{check.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
