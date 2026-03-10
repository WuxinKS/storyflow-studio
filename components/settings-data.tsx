import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getProjectStageLabel } from '@/lib/display';
import { getLlmConfig } from '@/lib/llm';
import { getGeneratedMediaEntries, summarizeGeneratedMediaCounts } from '@/features/media/service';
import { buildProjectHref } from '@/lib/project-links';

function maskUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function pickConfiguredValue(preferred?: string, fallback?: string) {
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
  return '';
}

function parseTimeoutMs(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

export async function SettingsData({ projectId }: { projectId?: string }) {
  const llm = getLlmConfig();
  const sharedAuthHeader = process.env.STORYFLOW_PROVIDER_AUTH_HEADER || 'Authorization';
  const sharedAuthScheme = process.env.STORYFLOW_PROVIDER_AUTH_SCHEME || 'Bearer';
  const sharedApiKeyConfigured = Boolean(process.env.STORYFLOW_PROVIDER_API_KEY);
  const providers = [
    {
      key: 'image',
      title: '图像 Provider',
      url: process.env.STORYFLOW_IMAGE_PROVIDER_URL || '',
      authHeader: pickConfiguredValue(process.env.STORYFLOW_IMAGE_PROVIDER_AUTH_HEADER, sharedAuthHeader),
      authScheme: pickConfiguredValue(process.env.STORYFLOW_IMAGE_PROVIDER_AUTH_SCHEME, sharedAuthScheme),
      timeoutMs: parseTimeoutMs(pickConfiguredValue(process.env.STORYFLOW_IMAGE_PROVIDER_TIMEOUT_MS, process.env.STORYFLOW_PROVIDER_TIMEOUT_MS), 300000),
      apiKeySource: process.env.STORYFLOW_IMAGE_PROVIDER_API_KEY ? '独立 Key' : sharedApiKeyConfigured ? '共享 Key' : '未配置 Key',
    },
    {
      key: 'voice',
      title: '语音 Provider',
      url: process.env.STORYFLOW_VOICE_PROVIDER_URL || '',
      authHeader: pickConfiguredValue(process.env.STORYFLOW_VOICE_PROVIDER_AUTH_HEADER, sharedAuthHeader),
      authScheme: pickConfiguredValue(process.env.STORYFLOW_VOICE_PROVIDER_AUTH_SCHEME, sharedAuthScheme),
      timeoutMs: parseTimeoutMs(pickConfiguredValue(process.env.STORYFLOW_VOICE_PROVIDER_TIMEOUT_MS, process.env.STORYFLOW_PROVIDER_TIMEOUT_MS), 300000),
      apiKeySource: process.env.STORYFLOW_VOICE_PROVIDER_API_KEY ? '独立 Key' : sharedApiKeyConfigured ? '共享 Key' : '未配置 Key',
    },
    {
      key: 'video',
      title: '视频 Provider',
      url: process.env.STORYFLOW_VIDEO_PROVIDER_URL || '',
      authHeader: pickConfiguredValue(process.env.STORYFLOW_VIDEO_PROVIDER_AUTH_HEADER, sharedAuthHeader),
      authScheme: pickConfiguredValue(process.env.STORYFLOW_VIDEO_PROVIDER_AUTH_SCHEME, sharedAuthScheme),
      timeoutMs: parseTimeoutMs(pickConfiguredValue(process.env.STORYFLOW_VIDEO_PROVIDER_TIMEOUT_MS, process.env.STORYFLOW_PROVIDER_TIMEOUT_MS), 300000),
      apiKeySource: process.env.STORYFLOW_VIDEO_PROVIDER_API_KEY ? '独立 Key' : sharedApiKeyConfigured ? '共享 Key' : '未配置 Key',
    },
  ];
  const enabledProviders = providers.filter((item) => item.url).length;
  const providerSpecificKeyCount = providers.filter((item) => item.apiKeySource === '独立 Key').length;
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

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">运行时设置</p>
        <h3>模型与 Provider 状态</h3>
        <p>这里集中展示默认模型、真实 Provider、鉴权策略、模拟回退与导出目录，方便判断当前环境更适合演示、联调还是正式执行。</p>
        <div className="meta-list">
          <span>默认模型：{llm.model}</span>
          <span>LLM：{llm.enabled ? '已接通' : '未接通，回退模板输出'}</span>
          <span>真实 Provider：{enabledProviders} / {providers.length}</span>
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
          </div>
        </div>
        {providers.map((provider) => (
          <div key={provider.key} className="asset-tile">
            <span className="label">{provider.title}</span>
            <h4>{provider.url ? '已配置真实 endpoint' : '当前走 mock fallback'}</h4>
            <p>{provider.url ? maskUrl(provider.url) : '未配置真实 endpoint 时，生成工作台仍可生成请求 / 响应工件并完成质量检查 / 导出闭环。'}</p>
            <div className="meta-list">
              <span>鉴权头：{provider.authHeader}</span>
              <span>鉴权方案：{provider.authScheme}</span>
              <span>超时：{provider.timeoutMs} ms</span>
              <span>{provider.apiKeySource}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">执行策略</span>
          <h4>真实执行与模拟执行</h4>
          <p>{enabledProviders > 0 ? '当前至少已有一个真实 Provider 可用；未配置的 Provider 仍会自动回退到模拟执行。' : '当前三个生成环节都还没有配置真实 Provider，系统会统一走模拟执行闭环。'}</p>
        </div>
        <div className="asset-tile">
          <span className="label">导出目录</span>
          <h4>工件与交付包</h4>
          <p><code>exports/render-runs</code> 保存执行请求 / 响应工件，交付包内还会带上 <code>generated-media-library.json</code> 媒体索引。</p>
        </div>
        <div className="asset-tile">
          <span className="label">下一步建议</span>
          <h4>环境补齐顺序</h4>
          <p>{llm.enabled ? '优先继续补图像 / 语音 / 视频 Provider，并按 Provider 拆分独立鉴权。' : '先补 LLM endpoint，再补图像 / 语音 / 视频 Provider，能最快形成真实主链。'}</p>
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
