"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeliveryExportButton({
  projectId,
  mode = 'create',
}: {
  projectId: string;
  mode?: 'create' | 'refresh';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const copy = mode === 'create'
    ? {
        button: '生成首份交付包',
        loading: '正在生成交付包…',
      }
    : {
        button: '重新导出当前交付包',
        loading: '正在重新导出…',
      };

  const onExport = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/render?action=export-production-bundle&projectId=${encodeURIComponent(projectId)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '交付包导出失败');

      const bundleDir = data.data?.bundleDir || '已生成新的交付目录';
      setMessage(`交付包已生成：${bundleDir}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="action-row wrap-row">
        <button type="button" className="button-primary" onClick={onExport} disabled={loading}>
          {loading ? copy.loading : copy.button}
        </button>
      </div>
      {message ? <span className="success-text">{message}</span> : null}
    </div>
  );
}
