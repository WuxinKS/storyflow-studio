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

type QaMission = {
  title: string;
  guidance: string;
  actionLabel: string;
  actionHref: string;
};

function rankGroupCard(input: { blockers: number; failed: number; checks: unknown[] }) {
  return input.blockers * 100 + input.failed * 10 + input.checks.length;
}

function getQaMission(input: {
  projectId: string;
  readyToDeliver: boolean;
  blockerCount: number;
  failedKeys: Set<string>;
}) {
  if (input.readyToDeliver) {
    return {
      title: '质检已通过，下一步直接去交付中心收口',
      guidance: '这时不需要继续在检查列表里打转，先去看交付包、预演结果和最终导出是否符合预期。',
      actionLabel: '去交付中心收尾',
      actionHref: buildProjectHref('/delivery-center', input.projectId),
    } satisfies QaMission;
  }

  if (
    ['scene-count', 'shot-count', 'shot-count-per-scene', 'sync-stale'].some((key) => input.failedKeys.has(key))
    || input.blockerCount > 0
  ) {
    return {
      title: '先修主链结构或同步问题，再看其他提醒',
      guidance: '分场、镜头或同步状态没稳定时，后面的渲染与交付检查都会连带失真。先在快速修复入口处理主链问题。',
      actionLabel: '打开快速修复入口',
      actionHref: '#qa-repair',
    } satisfies QaMission;
  }

  if (['render-jobs', 'render-completed', 'generated-media-index', 'final-video'].some((key) => input.failedKeys.has(key))) {
    return {
      title: '先把渲染执行链跑通，再回来复看质检',
      guidance: '结构层已经差不多了，现在更关键的是确认任务能提交、能完成、媒体能回流。',
      actionLabel: '去生成工作台继续联调',
      actionHref: buildProjectHref('/render-studio', input.projectId),
    } satisfies QaMission;
  }

  if (['reference-bindings', 'provider-bound-references'].some((key) => input.failedKeys.has(key))) {
    return {
      title: '补参考绑定，让画面和视频约束真正生效',
      guidance: '参考素材已经存在，但还没有稳定进入镜头与 Provider 载荷。先补绑定，再继续跑结果更有意义。',
      actionLabel: '去参考实验室补绑定',
      actionHref: buildProjectHref('/reference-lab', input.projectId),
    } satisfies QaMission;
  }

  return {
    title: '优先从快速修复入口处理未通过项',
    guidance: '这页的目标不是阅读所有检查项，而是先修最影响交付的一小批问题，再回来确认剩余提示。',
    actionLabel: '打开快速修复入口',
    actionHref: '#qa-repair',
  } satisfies QaMission;
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
  const failedKeys = new Set(report.checks.filter((check) => !check.passed).map((check) => check.key));
  const qaMission = getQaMission({
    projectId: report.projectId,
    readyToDeliver: report.summary.readyToDeliver,
    blockerCount: report.summary.blockerCount,
    failedKeys,
  });
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
  }).sort((left, right) => rankGroupCard(right) - rankGroupCard(left));
  const primaryGroup = groupCards[0] || null;
  const primaryGroupChecks = primaryGroup
    ? primaryGroup.checks.filter((check) => !check.passed).concat(primaryGroup.checks.filter((check) => check.passed).slice(0, 2))
    : [];
  const remainingGroups = groupCards.slice(1);

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
            这页现在先告诉我们“能不能交付、先修哪里”，而不是把所有检查一股脑铺开。
            先处理阻断项和最高风险分组，其余分组按需再看。
          </p>

          <div className="meta-list">
            <span>通过 {report.summary.passed}</span>
            <span>失败 {report.summary.failed}</span>
            <span>阻断项 {report.summary.blockerCount}</span>
            <span>成熟度 {report.summary.maturity}</span>
            <span>总检查 {totalChecks}</span>
          </div>

          <div className="asset-tile qa-focus-card">
            <span className="label">当前主任务</span>
            <h4>{qaMission.title}</h4>
            <p>{qaMission.guidance}</p>
            <div className="action-row wrap-row">
              <a href={qaMission.actionHref} className="button-primary">{qaMission.actionLabel}</a>
            </div>
            <details className="workflow-disclosure">
              <summary>需要时打开其他入口</summary>
              <div className="workflow-disclosure-body">
                <div className="action-row wrap-row">
                  <Link href={buildProjectHref('/render-studio', report.projectId)} className="button-ghost">查看生成工作台</Link>
                  <Link href={buildProjectHref('/render-runs', report.projectId)} className="button-secondary">查看运行诊断</Link>
                  <Link href={buildProjectHref('/delivery-center', report.projectId)} className="button-secondary">查看交付中心</Link>
                </div>
              </div>
            </details>
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
        title={report.summary.readyToDeliver ? '当前已通过质检，修复入口暂时折叠' : '默认先用快速修复入口处理主问题'}
        description={report.summary.readyToDeliver ? '当前主链已经达到可交付状态，需要时再展开修复动作。' : '先在这里处理最关键的修复动作，减少在故事、渲染、参考和交付页面之间来回跳。'}
      >
        {report.summary.readyToDeliver ? (
          <div id="qa-repair" className="asset-tile ops-detail-card">
            <span className="label">当前状态</span>
            <h4>主链已达可交付</h4>
            <p>这时更建议去交付中心复看 bundle、zip 和成片预演结果；修复入口只在你准备再跑一轮时打开。</p>
          </div>
        ) : (
          <div id="qa-repair">
            <QaActionCenter
              projectId={report.projectId}
              readyToDeliver={report.summary.readyToDeliver}
              checks={report.checks.map((check) => ({ key: check.key, passed: check.passed }))}
            />
          </div>
        )}

        {report.summary.readyToDeliver ? (
          <details className="workflow-disclosure">
            <summary>需要时打开快速修复入口</summary>
            <div className="workflow-disclosure-body">
              <QaActionCenter
                projectId={report.projectId}
                readyToDeliver={report.summary.readyToDeliver}
                checks={report.checks.map((check) => ({ key: check.key, passed: check.passed }))}
              />
            </div>
          </details>
        ) : null}
      </SectionCard>

      <SectionCard
        eyebrow="Overview"
        title="先看风险最高的分组"
        description="默认只看最需要关注的几组，避免把所有检查项一口气读完。"
      >
        <div className="ops-overview-grid">
          {groupCards.slice(0, 3).map((group) => (
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

      {primaryGroup ? (
        <SectionCard
          eyebrow={primaryGroup.title}
          title={`默认先看：${primaryGroup.title}`}
          description="这一组当前最值得先处理。默认先展示未通过项，再补少量已通过项帮助判断上下文。"
        >
          <div className="ops-check-grid">
            {primaryGroupChecks.map((check) => (
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
      ) : null}

      {remainingGroups.length > 0 ? (
        <details className="workflow-disclosure">
          <summary>需要时查看其他分组检查</summary>
          <div className="workflow-disclosure-body ops-run-stack">
            {remainingGroups.map((group) => (
              <section key={group.group} className="asset-tile ops-run-card">
                <div className="ops-provider-head">
                  <div>
                    <span className="label">{group.title}</span>
                    <h4>{group.failed === 0 ? '当前稳定' : `${group.failed} 项待处理`}</h4>
                  </div>
                  <span className="status-pill status-pill-subtle">{group.blockers > 0 ? `${group.blockers} 个阻断` : '按需查看'}</span>
                </div>
                <p>{`该分组共 ${group.checks.length} 项检查，帮助补齐 ${group.title} 这一层的闭环。`}</p>
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
              </section>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
