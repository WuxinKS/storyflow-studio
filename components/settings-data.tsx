import Link from 'next/link';
import { SectionCard } from '@/components/section-card';
import { prisma } from '@/lib/prisma';
import { getProjectStageLabel } from '@/lib/display';
import { getLlmConfig } from '@/lib/llm';
import { getGeneratedMediaEntries, summarizeGeneratedMediaCounts } from '@/features/media/service';
import { buildProjectHref } from '@/lib/project-links';
import { listProviderRuntimeConfigs } from '@/lib/provider-config';
import { listProviderAdapterSnapshots, type AdapterValueSource } from '@/lib/provider-adapters';

type RuntimeProbe = {
  state: 'not-configured' | 'reachable' | 'warn' | 'error';
  detail: string;
  httpStatus?: number;
  latencyMs?: number;
  checkedAt: string;
};

function maskUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function buildAuthHeaderValue(authScheme: string, apiKey: string) {
  if (!apiKey) return null;
  return /^(raw|none)$/i.test(authScheme) ? apiKey : `${authScheme} ${apiKey}`.trim();
}

function getProviderEnvPrefix(provider: 'image-sequence' | 'voice-synthesis' | 'video-assembly') {
  if (provider === 'image-sequence') return 'STORYFLOW_IMAGE_PROVIDER';
  if (provider === 'voice-synthesis') return 'STORYFLOW_VOICE_PROVIDER';
  return 'STORYFLOW_VIDEO_PROVIDER';
}

function getSourceLabel(source: AdapterValueSource) {
  if (source === 'env') return '环境覆盖';
  if (source === 'preset') return '预设默认';
  return '直接沿用';
}

function getBatchModeLabel(batchMode: 'single' | 'batch') {
  return batchMode === 'single' ? '逐条提交' : '批量提交';
}

function formatKeyPreview(values: string[], limit: number) {
  const picked = values.slice(0, limit);
  return picked.length > 0 ? picked.join(' / ') : '无';
}

async function probeEndpoint(input: {
  url?: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}) {
  const checkedAt = new Date().toISOString();
  if (!input.url) {
    return {
      state: 'not-configured',
      detail: '未配置 endpoint，当前不会做真实连通性检查。',
      checkedAt,
    } satisfies RuntimeProbe;
  }

  const controller = new AbortController();
  const effectiveTimeoutMs = Math.min(input.timeoutMs, 4000);
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(input.url, {
      method: 'GET',
      headers: input.headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const accepted = response.ok || [401, 403, 404, 405].includes(response.status);

    return {
      state: accepted ? 'reachable' : 'warn',
      detail: accepted ? `已收到响应（HTTP ${response.status}）。` : `已连通，但返回 HTTP ${response.status}。`,
      httpStatus: response.status,
      latencyMs,
      checkedAt,
    } satisfies RuntimeProbe;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        state: 'error',
        detail: `探测超时（>${effectiveTimeoutMs}ms）。`,
        checkedAt,
      } satisfies RuntimeProbe;
    }

    return {
      state: 'error',
      detail: error instanceof Error ? error.message : '探测失败',
      checkedAt,
    } satisfies RuntimeProbe;
  } finally {
    clearTimeout(timer);
  }
}

function getProbeLabel(probe: RuntimeProbe) {
  if (probe.state === 'reachable') return '已连通';
  if (probe.state === 'warn') return '已响应';
  if (probe.state === 'error') return '不可达';
  return '未配置';
}

function getRuntimeSummaryLabel(enabledProviders: number, reachableProviders: number) {
  if (enabledProviders === 0) return '当前以模拟执行为主';
  if (reachableProviders === enabledProviders) return '真实 Provider 已基本就绪';
  if (reachableProviders > 0) return '部分真实 Provider 已接通';
  return '真实 Provider 待联通';
}

type SettingsMission = {
  title: string;
  guidance: string;
  actionLabel: string;
  actionHref: string;
};

function getProviderEnvNames(provider: 'image-sequence' | 'voice-synthesis' | 'video-assembly') {
  const prefix = getProviderEnvPrefix(provider);
  return {
    url: `${prefix}_URL`,
    name: `${prefix}_NAME`,
    model: `${prefix}_MODEL`,
    apiKey: `${prefix}_API_KEY`,
  };
}

function getSettingsMission(input: {
  projectId?: string;
  llmEnabled: boolean;
  enabledProviders: number;
  reachableProviders: number;
  missingProviderProfileCount: number;
  missingProviderKeyCount: number;
  renderJobCount: number;
  generatedMediaCount: number;
}) {
  if (!input.llmEnabled) {
    return {
      title: '先补 LLM，让小说生成与分镜改编走真实模型',
      guidance: '现在最先卡住的是文本主脑。先补 LLM base URL、API Key 和模型名，再回来验证 Provider 链路。',
      actionLabel: '查看 LLM 配置要点',
      actionHref: '#runtime-checklist',
    } satisfies SettingsMission;
  }

  if (input.enabledProviders === 0) {
    return {
      title: '先接入第一批真实 Provider',
      guidance: '当前图像、语音、视频都还在模拟执行。先接通至少一个图像或视频 Provider，就能把主链从演示态推进到真实联调态。',
      actionLabel: '查看 Provider 配置清单',
      actionHref: '#provider-checklist',
    } satisfies SettingsMission;
  }

  if (input.reachableProviders < input.enabledProviders) {
    return {
      title: '先打通已经声明的 Provider 连通性',
      guidance: '现在不是继续补更多配置，而是先把已经写入的真实 Provider 跑通。连通后再扩展更多供应商会更稳。',
      actionLabel: '查看完整连通性矩阵',
      actionHref: '#provider-matrix',
    } satisfies SettingsMission;
  }

  if (input.missingProviderProfileCount > 0 || input.missingProviderKeyCount > 0) {
    return {
      title: '补齐供应商名、模型名和鉴权，避免后面联调漂移',
      guidance: '真实 Provider 已经有入口，但关键信息还不完整。先补齐模型声明和 Key，再进入渲染联调，定位问题会更直接。',
      actionLabel: '查看 Provider 配置清单',
      actionHref: '#provider-checklist',
    } satisfies SettingsMission;
  }

  if (input.renderJobCount === 0) {
    return {
      title: '运行时已经基本就绪，下一步去生成工作台起第一批任务',
      guidance: '配置层不用继续久留了。现在更有价值的是用真实项目创建渲染任务，看看图片、音轨和视频是否真的回流。',
      actionLabel: '去生成工作台联调',
      actionHref: buildProjectHref('/render-studio', input.projectId),
    } satisfies SettingsMission;
  }

  if (input.generatedMediaCount === 0) {
    return {
      title: '已有任务但产物还没回流，先去看运行状态',
      guidance: '说明配置层基本可用，下一步要检查请求是否提交成功、异步任务是否完成，以及媒体索引是否落库。',
      actionLabel: '去运行诊断查看状态',
      actionHref: buildProjectHref('/render-runs', input.projectId),
    } satisfies SettingsMission;
  }

  return {
    title: '配置层已经基本稳定，带着当前项目继续做结果验证',
    guidance: '现在更适合回主链检查生成结果和质量，而不是继续在配置页停留。配置页只在有异常时再回来复查。',
    actionLabel: '去质量检查验证闭环',
    actionHref: buildProjectHref('/qa-panel', input.projectId),
  } satisfies SettingsMission;
}

export async function SettingsData({ projectId }: { projectId?: string }) {
  const llm = getLlmConfig();
  const sharedAuthHeader = process.env.STORYFLOW_PROVIDER_AUTH_HEADER || 'Authorization';
  const sharedAuthScheme = process.env.STORYFLOW_PROVIDER_AUTH_SCHEME || 'Bearer';
  const adapterSnapshots = listProviderAdapterSnapshots();
  const providers = listProviderRuntimeConfigs().map((provider) => ({
    ...provider,
    adapterSnapshot: adapterSnapshots.find((item) => item.provider === provider.provider) || null,
  }));
  const enabledProviders = providers.filter((item) => item.executionModeHint === 'remote').length;
  const pollingProviders = providers.filter((item) => item.adapterSnapshot?.poll.enabled).length;
  const providerSpecificKeyCount = providers.filter((item) => item.apiKeySource === 'provider').length;
  const namedProviders = providers.filter((item) => item.nameConfigured).length;
  const modeledProviders = providers.filter((item) => item.modelConfigured).length;
  const adapterOverrideCount = providers.filter((item) => {
    const adapter = item.adapterSnapshot;
    if (!adapter) return false;
    return adapter.requestPathSource === 'env'
      || adapter.responseItemsKeySource === 'env'
      || adapter.extraHeadersSource === 'env'
      || adapter.extraBodySource === 'env'
      || adapter.voiceIdSource === 'env'
      || adapter.pollHasOverrides;
  }).length;

  const latestProject = await (projectId
    ? prisma.project.findUnique({
        where: { id: projectId },
        include: {
          chapters: true,
          scenes: true,
          shots: true,
          references: true,
          outlines: { orderBy: { createdAt: 'desc' } },
          renderJobs: { orderBy: { createdAt: 'desc' } },
        },
      })
    : prisma.project.findFirst({
        orderBy: { updatedAt: 'desc' },
        include: {
          chapters: true,
          scenes: true,
          shots: true,
          references: true,
          outlines: { orderBy: { createdAt: 'desc' } },
          renderJobs: { orderBy: { createdAt: 'desc' } },
        },
      })).catch(() => null);
  const generatedMediaCounts = summarizeGeneratedMediaCounts(getGeneratedMediaEntries(latestProject));

  const llmProbe = await probeEndpoint({
    url: llm.enabled ? `${llm.baseUrl}/models` : undefined,
    timeoutMs: llm.timeoutMs,
    headers: llm.apiKey
      ? {
          Authorization: `Bearer ${llm.apiKey}`,
        }
      : undefined,
  });

  const providerProbes = await Promise.all(
    providers.map(async (provider) => ({
      key: provider.provider,
      probe: await probeEndpoint({
        url: provider.url || undefined,
        timeoutMs: provider.timeoutMs,
        headers: provider.apiKey
          ? {
              [provider.authHeader]: buildAuthHeaderValue(provider.authScheme, provider.apiKey) || '',
            }
          : undefined,
      }),
    })),
  );

  const reachableProviders = providerProbes.filter((item) => item.probe.state === 'reachable').length;
  const runtimeSummaryLabel = getRuntimeSummaryLabel(enabledProviders, reachableProviders);
  const missingProviderProfileCount = providers.filter((item) => item.executionModeHint === 'remote' && (!item.nameConfigured || !item.modelConfigured)).length;
  const missingProviderKeyCount = providers.filter((item) => item.executionModeHint === 'remote' && !item.apiKeyConfigured).length;
  const settingsMission = getSettingsMission({
    projectId: latestProject?.id,
    llmEnabled: llm.enabled,
    enabledProviders,
    reachableProviders,
    missingProviderProfileCount,
    missingProviderKeyCount,
    renderJobCount: latestProject?.renderJobs.length || 0,
    generatedMediaCount: generatedMediaCounts.total,
  });

  return (
    <div className="page-stack">
      <div className="ops-command-grid">
        <section className="snapshot-card ops-command-card">
          <div className="ops-command-head">
            <div>
              <p className="eyebrow">Runtime Command</p>
              <h3>模型与 Provider 状态</h3>
            </div>
            <span className="status-pill status-pill-subtle">{runtimeSummaryLabel}</span>
          </div>

          <p>
            这页现在不再把所有配置一次性摊开，而是先判断当前最该补哪一层：
            文本主脑、真实 Provider、连通性，还是直接回项目里做联调验证。
          </p>

          <div className="meta-list">
            <span>默认模型 {llm.model}</span>
            <span>LLM {llm.enabled ? '已接通' : '回退模板输出'}</span>
            <span>真实 Provider {enabledProviders} / {providers.length}</span>
            <span>已连通 {reachableProviders} / {providers.length}</span>
            <span>轮询已启用 {pollingProviders} / {providers.length}</span>
            <span>适配覆写 {adapterOverrideCount} / {providers.length}</span>
          </div>

          <div className="asset-tile settings-focus-card">
            <span className="label">当前主任务</span>
            <h4>{settingsMission.title}</h4>
            <p>{settingsMission.guidance}</p>
            <div className="action-row wrap-row">
              <a href={settingsMission.actionHref} className="button-primary">{settingsMission.actionLabel}</a>
            </div>
            <details className="workflow-disclosure">
              <summary>需要时打开其他入口</summary>
              <div className="workflow-disclosure-body">
                <div className="action-row wrap-row">
                  <Link href={buildProjectHref('/render-studio', latestProject?.id)} className="button-ghost">查看生成工作台</Link>
                  <Link href={buildProjectHref('/render-runs', latestProject?.id)} className="button-secondary">查看运行诊断</Link>
                  <Link href={buildProjectHref('/qa-panel', latestProject?.id)} className="button-secondary">查看质量检查</Link>
                </div>
              </div>
            </details>
          </div>
        </section>

        <aside className="ops-command-side">
          <div className="ops-kpi-grid">
            <div className="asset-tile ops-kpi-card">
              <span className="label">连通性</span>
              <h4>{reachableProviders}</h4>
              <p>当前共有 {reachableProviders} 个真实 Provider 已返回可识别响应。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">模型声明</span>
              <h4>{modeledProviders}</h4>
              <p>{modeledProviders} / {providers.length} 个 Provider 已显式写入模型名。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">供应商命名</span>
              <h4>{namedProviders}</h4>
              <p>{namedProviders} / {providers.length} 个 Provider 已写入供应商名。</p>
            </div>

            <div className="asset-tile ops-kpi-card">
              <span className="label">鉴权拆分</span>
              <h4>{providerSpecificKeyCount}</h4>
              <p>{providerSpecificKeyCount} 个 Provider 使用独立鉴权，其余继续走共享头 {sharedAuthHeader}。</p>
            </div>
          </div>
        </aside>
      </div>

      <SectionCard
        eyebrow="Checklist"
        title="默认先处理这一层，不一次看完整个配置矩阵"
        description="先看主脑、真实执行覆盖和验证动作；更细的 Provider 字段与探测结果按需再展开。"
      >
        <div id="runtime-checklist" className="ops-overview-grid">
          <div className="asset-tile ops-detail-card">
            <span className="label">LLM 配置</span>
            <h4>{llm.enabled ? maskUrl(llm.baseUrl) : '当前未配置 LLM Endpoint'}</h4>
            <div className="meta-list">
              <span>模型 {llm.model}</span>
              <span>API Key {llm.apiKey ? '已配置' : '未配置'}</span>
              <span>超时 {llm.timeoutMs} ms</span>
              <span>探测 {getProbeLabel(llmProbe)}</span>
              {typeof llmProbe.httpStatus === 'number' ? <span>HTTP {llmProbe.httpStatus}</span> : null}
              {typeof llmProbe.latencyMs === 'number' ? <span>延迟 {llmProbe.latencyMs} ms</span> : null}
            </div>
            <p>{llmProbe.detail}</p>
            <p>关键环境变量：<code>STORYFLOW_LLM_BASE_URL</code> / <code>STORYFLOW_LLM_API_KEY</code> / <code>STORYFLOW_LLM_MODEL</code></p>
          </div>

          <div className="asset-tile ops-detail-card">
            <span className="label">真实执行覆盖</span>
            <h4>{enabledProviders > 0 ? `${reachableProviders} / ${enabledProviders} 已连通` : '当前全部走模拟执行'}</h4>
            <p>
              {enabledProviders > 0
                ? '至少已有一部分真实 Provider 可以响应；未补齐的环节仍会自动回退到模拟执行，适合渐进联调。'
                : '当前三个生成环节都未接入真实 Provider，系统会完整走模拟执行闭环。'}
            </p>
            <div className="meta-list">
              <span>远程 Provider {enabledProviders} / {providers.length}</span>
              <span>缺供应商或模型 {missingProviderProfileCount}</span>
              <span>未配 Key {missingProviderKeyCount}</span>
            </div>
          </div>

          <div className="asset-tile ops-detail-card">
            <span className="label">适配与轮询</span>
            <h4>{pollingProviders > 0 ? '异步视频链已纳入监控' : '当前以同步接口 / 模拟接口为主'}</h4>
            <p>{pollingProviders > 0 ? `已有 ${pollingProviders} 个 Provider 启用了轮询，更适合视频任务型接口。` : '如果你准备接视频生成接口，建议优先确认轮询路径和状态键是否匹配。'} </p>
            <p>{adapterOverrideCount > 0 ? `已有 ${adapterOverrideCount} 个 Provider 使用环境变量覆写，适合私有网关字段。` : '当前主要依赖内置适配预设；只有字段不一致时再做覆写。'} </p>
          </div>

          <div className="asset-tile ops-detail-card">
            <span className="label">联调验证</span>
            <h4>{latestProject ? latestProject.title : '当前还没有项目上下文'}</h4>
            <p>{latestProject ? `渲染任务 ${latestProject.renderJobs.length} 个 / 媒体索引 ${generatedMediaCounts.total} 条。` : '先把环境配好，然后去创意工坊启动一个项目再回来联调。'} </p>
            <p>{latestProject ? (generatedMediaCounts.total > 0 ? '当前更适合去质量检查和成片预演验证闭环。' : latestProject.renderJobs.length > 0 ? '当前更适合去运行诊断确认任务是否跑完。' : '当前更适合去生成工作台创建第一批任务。') : '运行时配置之外，真实验证一定要带着项目走一次主链。'} </p>
          </div>
        </div>
      </SectionCard>

      <details id="provider-checklist" className="workflow-disclosure">
        <summary>需要时查看逐项 Provider 配置清单</summary>
        <div className="workflow-disclosure-body">
          <div className="ops-provider-grid">
            {providers.map((provider) => {
              const probe = providerProbes.find((item) => item.key === provider.provider)?.probe || {
                state: 'error',
                detail: '探测结果缺失。',
                checkedAt: new Date().toISOString(),
              } satisfies RuntimeProbe;
              const envNames = getProviderEnvNames(provider.provider);
              const missingFields = [
                provider.url ? null : 'URL',
                provider.executionModeHint === 'remote' && !provider.nameConfigured ? '供应商名' : null,
                provider.executionModeHint === 'remote' && !provider.modelConfigured ? '模型名' : null,
                provider.executionModeHint === 'remote' && !provider.apiKeyConfigured ? 'API Key' : null,
              ].filter(Boolean);

              return (
                <article key={provider.provider} className="asset-tile ops-detail-card">
                  <span className="label">{provider.title}</span>
                  <h4>{provider.executionModeHint === 'remote' ? `${provider.providerName} / ${provider.providerModel || '待补模型'}` : '当前走 mock fallback'}</h4>
                  <p>{provider.url ? maskUrl(provider.url) : '还没有写入真实 endpoint，当前会继续走模拟执行。'} </p>
                  <div className="meta-list">
                    <span>探测 {getProbeLabel(probe)}</span>
                    <span>鉴权 {provider.apiKeySourceLabel}</span>
                    <span>适配 {provider.adapter || 'auto'}</span>
                    <span>超时 {provider.timeoutMs} ms</span>
                  </div>
                  <p>{missingFields.length > 0 ? `建议先补：${missingFields.join(' / ')}` : '关键信息已齐，可以去运行页或生成页做真实联调。'}</p>
                  <p>关键环境变量：<code>{envNames.url}</code> / <code>{envNames.name}</code> / <code>{envNames.model}</code> / <code>{envNames.apiKey}</code></p>
                </article>
              );
            })}
          </div>
        </div>
      </details>

      <details id="provider-matrix" className="workflow-disclosure">
        <summary>需要时查看完整 Provider 矩阵与探测结果</summary>
        <div className="workflow-disclosure-body">
          <div className="ops-provider-grid">
            {providers.map((provider) => {
              const adapter = provider.adapterSnapshot;
              const probe = providerProbes.find((item) => item.key === provider.provider)?.probe || {
                state: 'error',
                detail: '探测结果缺失。',
                checkedAt: new Date().toISOString(),
              } satisfies RuntimeProbe;
              const providerEnvPrefix = getProviderEnvPrefix(provider.provider);

              return (
                <article key={provider.provider} className="asset-tile ops-provider-card">
                  <div className="ops-provider-head">
                    <div>
                      <span className="label">{provider.title}</span>
                      <h4>{provider.executionModeHint === 'remote' ? `${provider.providerName} / ${provider.providerModel || '未指定模型'}` : '当前走 mock fallback'}</h4>
                    </div>
                    <span className="status-pill status-pill-subtle">{getProbeLabel(probe)}</span>
                  </div>

                  <p>{provider.url ? maskUrl(provider.url) : '未配置真实 endpoint 时，系统会继续生成调试工件并完成模拟闭环。'} </p>

                  <div className="meta-list">
                    <span>供应商 {provider.providerName}</span>
                    <span>模型 {provider.providerModel || '未指定模型'}</span>
                    <span>适配 {provider.adapter || 'auto'}</span>
                    <span>鉴权头 {provider.authHeader}</span>
                    <span>鉴权方案 {provider.authScheme}</span>
                    <span>超时 {provider.timeoutMs} ms</span>
                    {adapter ? <span>预设 {adapter.presetLabel}</span> : null}
                    {adapter ? <span>请求 {getBatchModeLabel(adapter.batchMode)}</span> : null}
                    {adapter ? <span>轮询 {adapter.poll.enabled ? '已启用' : '未启用'}</span> : null}
                    {typeof probe.httpStatus === 'number' ? <span>HTTP {probe.httpStatus}</span> : null}
                    {typeof probe.latencyMs === 'number' ? <span>延迟 {probe.latencyMs} ms</span> : null}
                    <span>{provider.apiKeySourceLabel}</span>
                  </div>

                  <p>{probe.detail}</p>

                  {adapter ? (
                    <>
                      <p>提交路径：<code>{adapter.requestPathPreview}</code>（{getSourceLabel(adapter.requestPathSource)}）；响应键：<code>{adapter.responseItemsKey}</code>（{getSourceLabel(adapter.responseItemsKeySource)}）。</p>
                      <p>轮询策略：{adapter.pollSummary}；任务键：<code>{formatKeyPreview(adapter.poll.taskIdKeys, 4)}</code>；状态键：<code>{formatKeyPreview(adapter.poll.statusKeys, 4)}</code>。</p>
                      <p>{adapter.notes.join(' ')}</p>
                    </>
                  ) : null}

                  {provider.executionModeHint === 'remote' && (!provider.nameConfigured || !provider.modelConfigured) ? (
                    <p>建议补齐环境变量：{!provider.nameConfigured ? '供应商名' : ''}{!provider.nameConfigured && !provider.modelConfigured ? ' + ' : ''}{!provider.modelConfigured ? '模型名' : ''}。</p>
                  ) : null}

                  {provider.executionModeHint === 'remote' && adapter?.poll.enabled && !adapter.poll.path && adapter.poll.appendTaskId ? (
                    <p>当前默认按 <code>{'{submitEndpoint}/{taskId}'}</code> 回查；若供应商状态接口不同，请显式填写 <code>{providerEnvPrefix}_POLL_PATH</code>。</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </details>

      <details className="workflow-disclosure">
        <summary>需要时查看当前项目联调上下文</summary>
        <div className="workflow-disclosure-body">
          {latestProject ? (
            <div className="ops-overview-grid">
              <div className="asset-tile ops-detail-card">
                <span className="label">最新项目</span>
                <h4>{latestProject.title}</h4>
                <p>{latestProject.premise || '暂无故事前提'}</p>
                <div className="meta-list">
                  <span>阶段 {getProjectStageLabel(latestProject.stage)}</span>
                  <span>章节 {latestProject.chapters.length}</span>
                  <span>分场 {latestProject.scenes.length}</span>
                  <span>镜头 {latestProject.shots.length}</span>
                </div>
              </div>

              <div className="asset-tile ops-detail-card">
                <span className="label">参考与任务</span>
                <h4>链路覆盖情况</h4>
                <p>参考条目 {latestProject.references.length} 条，渲染任务 {latestProject.renderJobs.length} 个，媒体索引 {generatedMediaCounts.total} 条。</p>
              </div>

              <div className="asset-tile ops-detail-card">
                <span className="label">联调提示</span>
                <h4>推荐下一步</h4>
                <p>{generatedMediaCounts.total > 0 ? '当前项目已开始沉淀生成产物，建议继续查看分镜板、时间线与质量检查面板。' : latestProject.renderJobs.length > 0 ? '当前项目已经有渲染任务，建议继续执行并观察媒体索引回写。' : '当前项目还没有渲染任务，建议先去生成工作台创建并执行第一批任务。'} </p>
              </div>
            </div>
          ) : (
            <div className="asset-tile">
              <span className="label">空状态</span>
              <h4>还没有项目上下文</h4>
              <p>设置页已可先检查模型与 Provider 环境；等你创建项目后，这里会同步显示当前链路阶段与任务覆盖情况。</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
