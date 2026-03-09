import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getProjectStageLabel } from '@/lib/display';
import { getLlmConfig } from '@/lib/llm';

function maskUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export async function SettingsData() {
  const llm = getLlmConfig();
  const providers = [
    { key: 'image', title: '图像 Provider', url: process.env.STORYFLOW_IMAGE_PROVIDER_URL || '' },
    { key: 'voice', title: '语音 Provider', url: process.env.STORYFLOW_VOICE_PROVIDER_URL || '' },
    { key: 'video', title: '视频 Provider', url: process.env.STORYFLOW_VIDEO_PROVIDER_URL || '' },
  ];
  const enabledProviders = providers.filter((item) => item.url).length;
  const latestProject = await prisma.project.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      chapters: true,
      scenes: true,
      shots: true,
      references: true,
      renderJobs: { orderBy: { createdAt: 'desc' } },
    },
  }).catch(() => null);

  return (
    <div className="page-stack">
      <div className="snapshot-card">
        <p className="eyebrow">运行时设置</p>
        <h3>模型与 Provider 状态</h3>
        <p>这里集中展示默认模型、真实 Provider、模拟回退与导出目录，方便判断当前环境更适合演示、联调还是正式执行。</p>
        <div className="meta-list">
          <span>默认模型：{llm.model}</span>
          <span>LLM：{llm.enabled ? '已接通' : '未接通，回退模板输出'}</span>
          <span>真实 Provider：{enabledProviders} / {providers.length}</span>
          <span>鉴权头：{process.env.STORYFLOW_PROVIDER_AUTH_HEADER || 'Authorization'}</span>
        </div>
        <div className="action-row">
          <Link href="/render-studio" className="button-ghost">查看生成工作台</Link>
          <Link href="/qa-panel" className="button-secondary">查看质量检查</Link>
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
          </div>
        </div>
        {providers.map((provider) => (
          <div key={provider.key} className="asset-tile">
            <span className="label">{provider.title}</span>
            <h4>{provider.url ? '已配置真实 endpoint' : '当前走 mock fallback'}</h4>
            <p>{provider.url ? maskUrl(provider.url) : '未配置真实 endpoint 时，生成工作台仍可生成请求 / 响应工件并完成质量检查 / 导出闭环。'}</p>
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
          <p><code>exports/render-runs</code> 保存执行请求 / 响应工件，<code>exports/production</code> 保存生产交付包与 zip 文件。</p>
        </div>
        <div className="asset-tile">
          <span className="label">下一步建议</span>
          <h4>环境补齐顺序</h4>
          <p>{llm.enabled ? '优先继续补图像 / 语音 / 视频 Provider，减少模拟执行占比。' : '先补 LLM endpoint，再补图像 / 语音 / 视频 Provider，能最快形成真实主链。'}</p>
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
            <p>参考条目 {latestProject.references.length} 条，渲染任务 {latestProject.renderJobs.length} 个，可用于判断当前项目距离生成与交付还有多远。</p>
          </div>
          <div className="asset-tile">
            <span className="label">联调提示</span>
            <h4>适合继续推进</h4>
            <p>{latestProject.renderJobs.length > 0 ? '当前项目已经有渲染任务，建议继续查看生成工作台与质量检查面板。' : '当前项目还没有渲染任务，建议先去生成工作台创建并执行第一批任务。'}</p>
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
