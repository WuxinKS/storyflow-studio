import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getProjectStageLabel } from '@/lib/display';
import { getLlmConfig } from '@/lib/llm';
import { getGeneratedMediaEntries, summarizeGeneratedMediaCounts } from '@/features/media/service';
import { buildProjectHref } from '@/lib/project-links';
import { listProviderRuntimeConfigs } from '@/lib/provider-config';

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

export async function SettingsData({ projectId }: { projectId?: string }) {
  const llm = getLlmConfig();
  const sharedAuthHeader = process.env.STORYFLOW_PROVIDER_AUTH_HEADER || 'Authorization';
  const sharedAuthScheme = process.env.STORYFLOW_PROVIDER_AUTH_SCHEME || 'Bearer';
  const providers = listProviderRuntimeConfigs();
  const enabledProviders = providers.filter((item) => item.executionModeHint === 'remote').length;
  const providerSpecificKeyCount = providers.filter((item) => item.apiKeySource === 'provider').length;
  const namedProviders = providers.filter((item) => item.nameConfigured).length;
  const modeledProviders = providers.filter((item) => item.modelConfigured).length;
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

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">运行时设置</p>
        <h3>模型与 Provider 状态</h3>
        <p>这里集中展示默认模型、真实 Provider、鉴权策略、模拟回退、超时和连通性体检，方便判断当前环境更适合演示、联调还是正式执行。</p>
        <div className="meta-list">
          <span>默认模型：{llm.model}</span>
          <span>LLM：{llm.enabled ? '已接通' : '未接通，回退模板输出'}</span>
          <span>真实 Provider：{enabledProviders} / {providers.length}</span>
          <span>已连通 Provider：{reachableProviders} / {providers.length}</span>
          <span>已命名供应商：{namedProviders} / {providers.length}</span>
          <span>已声明模型：{modeledProviders} / {providers.length}</span>
          <span>独立鉴权：{providerSpecificKeyCount} / {providers.length}</span>
          <span>共享鉴权：{sharedAuthHeader} / {sharedAuthScheme}</span>
        </div>
        <div className="action-row">
          <Link href={buildProjectHref('/render-studio', latestProject?.id)} className="button-ghost">查看生成工作台</Link>
          <Link href={buildProjectHref('/qa-panel', latestProject?.id)} className="button-secondary">查看质量检查</Link>
        </div>
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">LLM 配置</span>
          <h4>文本生成引擎</h4>
          <p>{llm.enabled ? `当前已接通 ${maskUrl(llm.baseUrl)}。` : '当前未配置 LLM endpoint，将优先使用内置 fallback 模板完成故事与视觉生成。'}</p>
          <div className="meta-list">
            <span>模型：{llm.model}</span>
            <span>API Key：{llm.apiKey ? '已配置' : '未配置'}</span>
            <span>超时：{llm.timeoutMs} ms</span>
            <span>探测：{getProbeLabel(llmProbe)}</span>
            {typeof llmProbe.httpStatus === 'number' ? <span>HTTP：{llmProbe.httpStatus}</span> : null}
            {typeof llmProbe.latencyMs === 'number' ? <span>延迟：{llmProbe.latencyMs} ms</span> : null}
          </div>
          <p>{llmProbe.detail}</p>
        </div>
        {providers.map((provider) => {
          const probe = providerProbes.find((item) => item.key === provider.provider)?.probe || {
            state: 'error',
            detail: '探测结果缺失。',
            checkedAt: new Date().toISOString(),
          } satisfies RuntimeProbe;

          return (
            <div key={provider.provider} className="asset-tile">
              <span className="label">{provider.title}</span>
              <h4>{provider.executionModeHint === 'remote' ? `${provider.providerName} / ${provider.providerModel || '未指定模型'}` : '当前走 mock fallback'}</h4>
              <p>{provider.url ? maskUrl(provider.url) : '未配置真实 endpoint 时，生成工作台仍可生成请求 / 响应工件并完成质量检查 / 导出闭环。'}</p>
              <div className="meta-list">
                <span>供应商：{provider.providerName}</span>
                <span>模型：{provider.providerModel || '未指定模型'}</span>
                <span>鉴权头：{provider.authHeader}</span>
                <span>鉴权方案：{provider.authScheme}</span>
                <span>超时：{provider.timeoutMs} ms</span>
                <span>探测：{getProbeLabel(probe)}</span>
                {typeof probe.httpStatus === 'number' ? <span>HTTP：{probe.httpStatus}</span> : null}
                {typeof probe.latencyMs === 'number' ? <span>延迟：{probe.latencyMs} ms</span> : null}
                <span>{provider.apiKeySourceLabel}</span>
              </div>
              <p>{probe.detail}</p>
              {provider.executionModeHint === 'remote' && (!provider.nameConfigured || !provider.modelConfigured) ? (
                <p>建议补齐环境变量：{!provider.nameConfigured ? '供应商名' : ''}{!provider.nameConfigured && !provider.modelConfigured ? ' + ' : ''}{!provider.modelConfigured ? '模型名' : ''}。</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">执行策略</span>
          <h4>真实执行与模拟执行</h4>
          <p>{enabledProviders > 0 ? '当前至少已有一个真实 Provider 可用；未配置的 Provider 仍会自动回退到模拟执行。建议同时补齐供应商名与模型名，便于联调和诊断。' : '当前三个生成环节都还没有配置真实 Provider，系统会统一走模拟执行闭环。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">导出目录</span>
          <h4>工件与交付包</h4>
          <p><code>exports/render-runs</code> 保存执行请求 / 响应工件，交付包内还会带上 <code>generated-media-library.json</code> 媒体索引。</p>
        </div>
        <div className="asset-tile">
          <span className="label">下一步建议</span>
          <h4>环境补齐顺序</h4>
          <p>{llm.enabled ? '优先继续补图像 / 语音 / 视频 Provider 的供应商名、模型名和独立鉴权。' : '先补 LLM endpoint，再补图像 / 语音 / 视频 Provider 的供应商、模型与鉴权，能最快形成真实主链。'}</p>
        </div>
      </div>

      {latestProject ? (
        <div className="asset-grid three-up">
          <div className="asset-tile">
            <span className="label">最新项目</span>
            <h4>{latestProject.title}</h4>
            <p>{latestProject.premise || '暂无故事前提'}</p>
            <div className="meta-list">
              <span>阶段：{getProjectStageLabel(latestProject.stage)}</span>
              <span>章节：{latestProject.chapters.length}</span>
              <span>分场：{latestProject.scenes.length}</span>
              <span>镜头：{latestProject.shots.length}</span>
            </div>
          </div>
          <div className="asset-tile">
            <span className="label">参考与生成</span>
            <h4>链路覆盖情况</h4>
            <p>参考条目 {latestProject.references.length} 条，渲染任务 {latestProject.renderJobs.length} 个，媒体索引 {generatedMediaCounts.total} 条。</p>
          </div>
          <div className="asset-tile">
            <span className="label">联调提示</span>
            <h4>适合继续推进</h4>
            <p>{generatedMediaCounts.total > 0 ? '当前项目已开始沉淀生成产物，建议继续查看分镜板、时间线与质量检查面板。' : latestProject.renderJobs.length > 0 ? '当前项目已经有渲染任务，建议继续执行并观察媒体索引回写。' : '当前项目还没有渲染任务，建议先去生成工作台创建并执行第一批任务。'}</p>
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
  );
}
