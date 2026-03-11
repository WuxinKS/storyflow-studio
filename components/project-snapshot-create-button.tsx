"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProjectSnapshotCreateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onCreate = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/projects/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'create',
          label: label.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '项目快照创建失败');
      setMessage(`已保存快照：${data.snapshot.label}`);
      setLabel('');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <label>
        <span>快照备注（可选）</span>
        <input
          type="text"
          placeholder="例如：小说初稿完成 / 分镜前 / 真实 Provider 联调前"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <div className="action-row wrap-row">
        <button type="button" className="button-primary" onClick={onCreate} disabled={loading}>
          {loading ? '保存快照中…' : '保存当前项目快照'}
        </button>
        {message ? <span className="success-text">{message}</span> : null}
      </div>
    </div>
  );
}
