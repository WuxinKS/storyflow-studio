import Link from 'next/link';
import { QaActionCenter } from '@/components/qa-action-center';
import { SectionCard } from '@/components/section-card';
import { getQaCheckToneLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';
import { getQaReport } from '@/features/qa/service';

const GROUP_LABELS = {
  structure: '结构检查',
  content: '内容检查',
  sync: '同步检查',
  render: '渲染检查',
  export: '交付检查',
} as const;

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export async function QaPanelData({ projectId }: { projectId?: string }) {
  const report = await getQaReport(projectId).catch(() => null);

  if (!report) {
    return (
      <div className="asset-tile">
        <span className="label">空状态</span>
        <h4>暂无质量检查数据</h4>
        <p>请先生成故事、改编与渲染数据，再回来查看质量检查结果。</p>
      </div>
    );
  }

  const totalChecks = report.checks.length;
  const passRate = toPercent(report.summary.passed, totalChecks);
  const groupCards = Object.entries(report.groupedChecks).map(([group, checks]) => {
    const passed = checks.filter((item) => item.passed).length;
    const failed = checks.length - passed;
    const blockers = checks.filter((item) => item.blocksDelivery).length;

    return {
      group,
      title: GROUP_LABELS[group as keyof typeof GROUP_LABELS],
      checks,
      passed,
      failed,
      blockers,
    };
  });

  return (
    <div className="page-stack">
      <div className="ops-command-grid">
        <section className="snapshot-card ops-command-card">
          <div className="ops-command-head">
            <div>
              <p className="eyebrow">QA Command</p>
              <h3>{report.projectTitle}</h3>
            </div>
            <span className="status-pill status-pill-subtle">{report.summary.readyToDeliver ? '可交付' : report.summary.maturity}</span>
          </div>

          <p>
            这页现在只做三件事：看整体成熟度、找阻断项、立刻跳到修复动作。
            不再把所有检查堆成一长串，先把我们最关心的交付风险放到最前面。
          </p>

          <div className="meta-list">
            <span>通过 {report.summary.passed}</span>
            <span>失败 {report.summary.failed}</span>
            <span>阻断项 {report.summary.blockerCount}</span>
            <span>成熟度 {report.summary.maturity}</span>
            <span>总检查 {totalChecks}</span>
          </div>

          <div className="action-row wrap-row">
            <Link href={buildProjectHref('/render-studio', report.projectId)} className="button-ghost">查看生成工作台</Link>
            <Link href={buildProjectHref('/render-runs', report.projectId)} className="button-secondary">查看运行诊断</Link>
            <Link href={buildProjectHref('/delivery-center', report.projectId)} className="button-secondary">查看交付中心</Link>
          </div>
        </section>

        <aside className="ops-command-side">
          <div className="ops-kpi-grid">
            <div className="asset-tile ops-kpi-card">
              <span className="label">通过率</span>
              <h4>{passRate}%</h4>
              <div className="progress-strip">
                <span className="progress-fill progress-fill-accent-2" style={{ width: `${passRate}%` }} />
              </div>
              <p>{report.summary.passed} / {totalChecks} 项检查已通过。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">阻断交付</span>
              <h4>{report.summary.blockerCount}</h4>
              <p>{report.summary.blockerLabels.join(' / ') || '当前没有阻断项。'}</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">最新交付包</span>
              <h4>{report.summary.bundleDir ? '已生成' : '尚未生成'}</h4>
              <p>{report.summary.bundleDir || '当前还没有成功写盘的交付包目录。'} </p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">Zip 状态</span>
              <h4>{report.summary.zipPath ? '已归档' : '未归档'}</h4>
              <p>{report.summary.zipPath || '当前还没有 zip 文件。'} </p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Repair"
        title="快速修复入口"
        description="发现问题后先在这里处理，减少在故事、渲染、参考和交付页面之间来回跳。"
      >
        <QaActionCenter
          projectId={report.projectId}
          readyToDeliver={report.summary.readyToDeliver}
          checks={report.checks.map((check) => ({ key: check.key, passed: check.passed }))}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Overview"
        title="检查分组概览"
        description="先看哪组风险最大，再往下钻到具体检查项。"
      >
        <div className="ops-overview-grid">
          {groupCards.map((group) => (
            <div key={group.group} className="asset-tile ops-detail-card">
              <span className="label">{group.title}</span>
              <h4>{group.failed === 0 ? '已稳定' : `${group.failed} 项待处理`}</h4>
              <div className="meta-list">
                <span>总数 {group.checks.length}</span>
                <span>通过 {group.passed}</span>
                <span>失败 {group.failed}</span>
                <span>阻断 {group.blockers}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {groupCards.map((group) => (
        <SectionCard
          key={group.group}
          eyebrow={group.title}
          title={group.title}
          description={`该分组下共 ${group.checks.length} 项检查，帮助更快定位当前主链还差哪一段没有闭环。`}
        >
          <div className="ops-check-grid">
            {group.checks.map((check) => (
              <div key={check.key} className="asset-tile ops-check-card">
                <div className="ops-provider-head">
                  <div>
                    <span className="label">{getQaCheckToneLabel(check.passed ? 'pass' : check.blocksDelivery ? 'blocker' : 'warning')}</span>
                    <h4>{check.label}</h4>
                  </div>
                  <span className="status-pill status-pill-subtle">{check.passed ? '通过' : check.blocksDelivery ? '阻断' : '提醒'}</span>
                </div>
                <p>{check.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
