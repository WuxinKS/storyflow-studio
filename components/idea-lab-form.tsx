"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { defaultProjectDraft, ProjectDraft } from '@/features/project/draft';
import { useProjectDraft } from '@/features/project/use-project-draft';
type SubmitMode = 'create' | 'pipeline-full';

const OUTPUT_LABELS: Record<ProjectDraft['output'], string> = {
  novel: '小说',
  screenplay: '剧本',
  video: '视频',
};

const OUTPUT_HINTS: Record<ProjectDraft['output'], string> = {
  novel: '更适合先拉长故事正文，再进入改编和分镜。',
  screenplay: '更适合先稳定场次结构和对白，再进入镜头化。',
  video: '更适合直接沿着一句话到分镜、图片、视频的主链推进。',
};

export function IdeaLabForm() {
  const router = useRouter();
  const { draft, persist, ready } = useProjectDraft();
  const [saved, setSaved] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<SubmitMode | null>(null);
  const [message, setMessage] = useState<string>('');

  const current = ready ? draft : defaultProjectDraft;
  const outputLabel = OUTPUT_LABELS[current.output];
  const outputHint = OUTPUT_HINTS[current.output];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;
    const mode: SubmitMode = submitter?.value === 'pipeline-full' ? 'pipeline-full' : 'create';
    const formData = new FormData(event.currentTarget);
    const next: ProjectDraft = {
      title: String(formData.get('title') || ''),
      hook: String(formData.get('hook') || ''),
      genre: String(formData.get('genre') || ''),
      style: String(formData.get('style') || ''),
      output: String(formData.get('output') || 'video') as ProjectDraft['output'],
    };

    persist(next);
    setSaved(true);
    setSubmittingMode(mode);
    setMessage('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...next,
          runPipelineMode: mode === 'pipeline-full' ? 'full' : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || '保存到数据库失败');
      }

      if (mode === 'pipeline-full') {
        const completedSteps = Array.isArray(data.run?.steps)
          ? data.run.steps.filter((step: { status: string }) => step.status === 'completed').length
          : 0;
        const previewReady = Boolean(data.artifacts?.previewReady);
        setMessage(
          previewReady
            ? `已创建项目并跑完整主链：${data.project.title}（完成 ${completedSteps} 个步骤，预演成片已生成）`
            : `已创建项目并跑完整主链：${data.project.title}（完成 ${completedSteps} 个步骤）`,
        );
        router.push(typeof data.nextActionHref === 'string' ? data.nextActionHref : `/final-cut?projectId=${data.project.id}`);
        router.refresh();
        return;
      }

      setMessage(`已创建项目：${data.project.title}`);
      if (typeof data.nextActionHref === 'string') {
        router.push(data.nextActionHref);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmittingMode(null);
      setTimeout(() => setSaved(false), 1800);
    }
  };

  return (
    <form className="kickoff-grid" onSubmit={handleSubmit}>
      <section className="form-card kickoff-form-panel">
        <div className="kickoff-panel-head">
          <div>
            <p className="eyebrow">项目表单</p>
            <h3>把目标说清楚，再决定启动方式</h3>
          </div>
          <span className="status-pill status-pill-subtle">当前输出：{outputLabel}</span>
        </div>

        <div className="form-grid">
          <label>
            <span>项目标题</span>
            <input name="title" defaultValue={current.title} placeholder="例如：灵感成片 Demo" />
          </label>
          <label>
            <span>目标输出</span>
            <select name="output" defaultValue={current.output}>
              <option value="novel">小说</option>
              <option value="screenplay">剧本</option>
              <option value="video">视频</option>
            </select>
          </label>
          <label className="full-width">
            <span>一句话创意</span>
            <textarea name="hook" rows={4} defaultValue={current.hook} />
          </label>
          <label>
            <span>题材</span>
            <input name="genre" defaultValue={current.genre} placeholder="科幻 / 奇幻 / 悬疑" />
          </label>
          <label>
            <span>风格</span>
            <input name="style" defaultValue={current.style} placeholder="电影感、短剧节奏、强情绪" />
          </label>
        </div>

        <div className="kickoff-action-bar">
          <button type="submit" name="submit-mode" value="pipeline-full" className="button-primary" disabled={Boolean(submittingMode)}>
            {submittingMode === 'pipeline-full' ? '正在直接生成样片链…' : '创建并直接生成完整样片链'}
          </button>
          <button type="submit" name="submit-mode" value="create" className="button-secondary" disabled={Boolean(submittingMode)}>
            {submittingMode === 'create' ? '正在创建项目…' : '先创建项目，再逐步推进'}
          </button>
          <Link href="/story-setup" className="button-ghost">查看最新故事设定</Link>
          {saved ? <span className="success-text">已保存到本地草稿</span> : null}
        </div>

        <p className="feedback-text">如果目标就是“一句话走到小说、分镜、图片、视频”，直接运行完整样片链即可。</p>
        {message ? <p className="feedback-text">{message}</p> : null}
      </section>

      <aside className="kickoff-side-panel">
        <div className="kickoff-side-card">
          <span className="label">目标输出</span>
          <h4>{outputLabel}</h4>
          <p>{outputHint}</p>
        </div>

        <div className="kickoff-side-card">
          <span className="label">本页职责</span>
          <div className="module-checklist">
            <div className="module-check-item">
              <span>01</span>
              <p>先定义项目标题、题材、风格和目标输出。</p>
            </div>
            <div className="module-check-item">
              <span>02</span>
              <p>如果方向明确，直接一键推进完整主链。</p>
            </div>
            <div className="module-check-item">
              <span>03</span>
              <p>如果还在试方向，就先落项目，再慢慢迭代。</p>
            </div>
          </div>
        </div>

        <div className="kickoff-side-card">
          <span className="label">启动方式</span>
          <div className="kickoff-mode-grid">
            <div className="kickoff-mode-card">
              <strong>直接出样片</strong>
              <p>适合方向明确，想直接看到小说、分镜、生成和成片预演。</p>
            </div>
            <div className="kickoff-mode-card">
              <strong>逐步推进</strong>
              <p>适合还在探索题材、节奏或风格，想先把主流程一步步走清楚。</p>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
