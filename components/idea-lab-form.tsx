"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { defaultProjectDraft, ProjectDraft } from '@/features/project/draft';
import { useProjectDraft } from '@/features/project/use-project-draft';

type SubmitMode = 'create' | 'pipeline-full';

export function IdeaLabForm() {
  const router = useRouter();
  const { draft, persist, ready } = useProjectDraft();
  const [saved, setSaved] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<SubmitMode | null>(null);
  const [message, setMessage] = useState<string>('');

  const current = ready ? draft : defaultProjectDraft;

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
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const projectData = await projectResponse.json();
      if (!projectResponse.ok || !projectData.ok) {
        throw new Error(projectData.error || '保存到数据库失败');
      }

      if (mode === 'pipeline-full') {
        const pipelineResponse = await fetch('/api/pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectData.project.id, mode: 'full' }),
        });
        const pipelineData = await pipelineResponse.json();
        if (!pipelineResponse.ok || !pipelineData.ok) {
          throw new Error(pipelineData.error || '主链执行失败');
        }
        const completedSteps = Array.isArray(pipelineData.run?.steps)
          ? pipelineData.run.steps.filter((step: { status: string }) => step.status === 'completed').length
          : 0;
        setMessage(`已创建项目并跑完整主链：${projectData.project.title}（完成 ${completedSteps} 个步骤）`);
        router.push('/render-studio');
        router.refresh();
        return;
      }

      setMessage(`已创建项目：${projectData.project.title}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmittingMode(null);
      setTimeout(() => setSaved(false), 1800);
    }
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
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
      <div className="action-row wrap-row">
        <button type="submit" name="submit-mode" value="pipeline-full" className="button-primary" disabled={Boolean(submittingMode)}>
          {submittingMode === 'pipeline-full' ? '主链执行中…' : '创建并一键跑完整主链'}
        </button>
        <button type="submit" name="submit-mode" value="create" className="button-secondary" disabled={Boolean(submittingMode)}>
          {submittingMode === 'create' ? '正在创建项目…' : '仅保存并创建项目'}
        </button>
        <Link href="/story-setup" className="button-ghost">查看最新故事设定</Link>
        {saved ? <span className="success-text">已保存到本地草稿</span> : null}
      </div>
      <p className="feedback-text">如果你现在的目标就是“一句话直出小说 / 分镜 / 视频”，直接点上面的主链按钮即可。</p>
      {message ? <p className="feedback-text">{message}</p> : null}
    </form>
  );
}
