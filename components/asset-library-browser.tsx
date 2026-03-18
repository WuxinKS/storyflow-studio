"use client";

import { useMemo, useState } from 'react';

type AssetCard = {
  id: string;
  type: string;
  title: string;
  summary: string;
  tags: string[];
  source: string;
  links: string[];
  mode: 'auto' | 'manual';
  previewKind?: 'image' | 'audio' | 'video';
  sourceUrl?: string;
  localPath?: string;
};

type AssetSection = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  items: AssetCard[];
};

function typeLabel(type: string) {
  if (type === 'character') return '角色资产';
  if (type === 'scene') return '场景资产';
  if (type === 'prop') return '道具资产';
  if (type === 'style-board') return '风格资产';
  if (type === 'generated-image') return '生成图片';
  if (type === 'generated-audio') return '生成音频';
  if (type === 'generated-video') return '生成视频';
  return '参考资产';
}

type FilterMode = 'all' | 'manual' | 'auto' | 'previewable';

function isRemoteSource(value: string | undefined) {
  return /^(https?:\/\/|data:|blob:|\/)/i.test(String(value || '').trim());
}

function isExportPath(value: string | undefined) {
  const normalized = String(value || '').trim();
  return normalized.includes('/exports/') || normalized.startsWith('exports/');
}

function resolvePreviewHref(input: { sourceUrl?: string; localPath?: string }) {
  if (input.sourceUrl && isRemoteSource(input.sourceUrl)) return input.sourceUrl;
  if (input.localPath && isExportPath(input.localPath)) {
    return `/api/media/file?path=${encodeURIComponent(input.localPath)}`;
  }
  return null;
}

export function AssetLibraryBrowser({ sections }: { sections: AssetSection[] }) {
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((asset) => {
          const matchesQuery = normalizedQuery.length === 0 || [
            asset.title,
            asset.summary,
            asset.source,
            ...asset.tags,
            ...asset.links,
          ].join(' ').toLowerCase().includes(normalizedQuery);

          const matchesMode = filterMode === 'all'
            || (filterMode === 'manual' && asset.mode === 'manual')
            || (filterMode === 'auto' && asset.mode === 'auto')
            || (filterMode === 'previewable' && Boolean(asset.previewKind));

          return matchesQuery && matchesMode;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [filterMode, query, sections]);

  return (
    <div className="library-browser">
      <div className="asset-tile library-filter-bar">
        <label className="library-search-field">
          <span>搜索资产</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜标题、摘要、标签、来源或关联信息" />
        </label>

        <div className="library-filter-actions">
          <button type="button" className={filterMode === 'all' ? 'filter-chip is-active' : 'filter-chip'} onClick={() => setFilterMode('all')}>全部</button>
          <button type="button" className={filterMode === 'manual' ? 'filter-chip is-active' : 'filter-chip'} onClick={() => setFilterMode('manual')}>手动录入</button>
          <button type="button" className={filterMode === 'auto' ? 'filter-chip is-active' : 'filter-chip'} onClick={() => setFilterMode('auto')}>自动聚合</button>
          <button type="button" className={filterMode === 'previewable' ? 'filter-chip is-active' : 'filter-chip'} onClick={() => setFilterMode('previewable')}>可预览</button>
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <div className="asset-tile">
          <span className="label">无匹配结果</span>
          <h4>当前筛选条件下没有资产</h4>
          <p>可以清空搜索词，或切回“全部”查看完整资产库。</p>
        </div>
      ) : (
        filteredSections.map((section) => (
          <section key={section.key} className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">{section.eyebrow}</p>
                <h2>{section.title}</h2>
              </div>
              <div className="section-header-side">
                <p>{section.description}</p>
              </div>
            </div>

            <div className="library-card-grid">
              {section.items.map((asset) => {
                const previewHref = asset.previewKind ? resolvePreviewHref({ sourceUrl: asset.sourceUrl, localPath: asset.localPath }) : null;

                return (
                  <article key={asset.id} className="asset-tile scene-tile library-card">
                    {asset.previewKind && previewHref ? (
                      asset.previewKind === 'image' ? (
                        <div className="media-preview-shell">
                          <img className="media-preview-visual" src={previewHref} alt={asset.title} />
                        </div>
                      ) : asset.previewKind === 'video' ? (
                        <div className="media-preview-shell">
                          <video className="media-preview-visual" src={previewHref} controls muted playsInline preload="metadata" />
                        </div>
                      ) : (
                        <div className="media-preview-shell media-preview-audio">
                          <audio className="media-preview-audio-control" src={previewHref} controls preload="metadata" />
                        </div>
                      )
                    ) : asset.previewKind ? (
                      <div className="media-preview-shell media-preview-empty">
                        <span>{asset.previewKind === 'video' ? '视频资产' : asset.previewKind === 'audio' ? '音频资产' : '图片资产'}</span>
                      </div>
                    ) : null}

                    <div className="library-card-head">
                      <div>
                        <span className="label">{typeLabel(asset.type)}</span>
                        <h4>{asset.title}</h4>
                      </div>
                      <span className="status-pill status-pill-subtle">{asset.mode === 'manual' ? '手动录入' : '自动聚合'}</span>
                    </div>

                    <p>{asset.summary}</p>

                    <div className="tag-list">
                      {asset.tags.map((tag) => (
                        <span key={`${asset.id}-${tag}`} className="tag-chip">{tag}</span>
                      ))}
                    </div>

                    <div className="meta-list">
                      <span>来源 {asset.source}</span>
                      {asset.links.map((link) => (
                        <span key={`${asset.id}-${link}`}>{link}</span>
                      ))}
                    </div>

                    {previewHref ? <a className="button-ghost" href={previewHref} target="_blank" rel="noreferrer">打开预览</a> : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
