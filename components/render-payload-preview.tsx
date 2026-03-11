import Link from 'next/link';
import { exportProviderPayloads } from '@/features/render/service';
import { getRenderProviderLabel } from '@/lib/display';
import { buildProjectHref } from '@/lib/project-links';

type PayloadRecord = Record<string, unknown>;
type ProviderPayloadGroup = {
  provider: 'image-sequence' | 'voice-synthesis' | 'video-assembly';
  items: PayloadRecord[];
  profile: PayloadRecord | null;
};

function toRecord(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as PayloadRecord;
  }
  return null;
}

function toRecordArray(value: unknown) {
  if (!Array.isArray(value)) return [] as PayloadRecord[];
  return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as PayloadRecord[];
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return normalizeText(value);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return uniqueValues(value.map((item) => normalizeText(item)).filter(Boolean));
}

function getPayloadGroups(providers: Record<string, unknown>, providerProfiles?: Record<string, unknown> | null) {
  return [
    {
      provider: 'image-sequence',
      items: toRecordArray(providers.imageSequence),
      profile: toRecord(providerProfiles?.imageSequence),
    },
    {
      provider: 'voice-synthesis',
      items: toRecordArray(providers.voiceSynthesis),
      profile: toRecord(providerProfiles?.voiceSynthesis),
    },
    {
      provider: 'video-assembly',
      items: toRecordArray(providers.videoAssembly),
      profile: toRecord(providerProfiles?.videoAssembly),
    },
  ] satisfies ProviderPayloadGroup[];
}

function getBoundTitles(item: PayloadRecord) {
  return toStringArray(item.boundReferenceTitles);
}

function getGlobalTitles(item: PayloadRecord) {
  return toStringArray(item.referenceTitles);
}

function getSourceMediaCount(item: PayloadRecord) {
  return uniqueValues([
    ...toStringArray(item.boundReferenceSourceUrls),
    ...toStringArray(item.boundReferenceLocalPaths),
    ...toStringArray(item.referenceSourceUrls),
    ...toStringArray(item.referenceLocalPaths),
  ]).length;
}

function getPayloadLabel(item: PayloadRecord) {
  return normalizeText(item.shotTitle) || normalizeText(item.sceneTitle) || '未命名载荷';
}

function getPayloadContext(item: PayloadRecord) {
  const sceneTitle = normalizeText(item.sceneTitle);
  const shotTitle = normalizeText(item.shotTitle);
  if (sceneTitle && shotTitle) return `${sceneTitle} · ${shotTitle}`;
  return sceneTitle || shotTitle || '暂无上下文';
}


function getProviderName(profile: PayloadRecord | null, item?: PayloadRecord) {
  return normalizeText(profile?.providerName) || normalizeText(item?.providerName) || 'Mock Fallback';
}

function getProviderModel(profile: PayloadRecord | null, item?: PayloadRecord) {
  return normalizeText(profile?.providerModel) || normalizeText(item?.providerModel) || '未指定模型';
}

function getProviderMode(profile: PayloadRecord | null, item?: PayloadRecord) {
  return normalizeText(profile?.executionModeHint) || normalizeText(item?.providerMode) || 'mock';
}

function getPayloadSummary(provider: ProviderPayloadGroup['provider'], item: PayloadRecord) {
  if (provider === 'image-sequence') {
    return normalizeText(item.boundReferencePromptLine)
      || normalizeText(item.prompt)
      || normalizeText(item.visualStyle)
      || '当前图像载荷已准备好交给 Provider。';
  }

  if (provider === 'voice-synthesis') {
    return normalizeText(item.boundReferencePromptLine)
      || normalizeText(item.summary)
      || normalizeText(item.referenceEmotion)
      || '当前语音载荷已准备好交给 Provider。';
  }

  return normalizeText(item.boundReferencePromptLine)
    || normalizeText(item.audioFocus)
    || normalizeText(item.visualStyle)
    || '当前视频载荷已准备好交给 Provider。';
}

function getPayloadMeta(provider: ProviderPayloadGroup['provider'], item: PayloadRecord) {
  const meta: string[] = [];
  const duration = normalizeValue(item.plannedDuration) || normalizeValue(item.targetDuration);
  const emotion = normalizeText(item.emotionLabel) || normalizeValue(item.emotionScore);
  const beat = normalizeText(item.beatType);
  const referenceReady = item.referenceReady === true ? '参考增强' : item.referenceReady === false ? '' : '';

  if (duration) meta.push(`时长 ${duration}`);
  if (emotion) meta.push(`情绪 ${emotion}`);
  if (beat) meta.push(`节拍 ${beat}`);
  if (referenceReady) meta.push(referenceReady);
  if (provider === 'image-sequence') {
    const motion = normalizeText(item.cameraMotion);
    if (motion) meta.push(`运动 ${motion.slice(0, 20)}`);
  }
  if (provider === 'voice-synthesis') {
    const audioPlan = normalizeText(item.audioPlan);
    if (audioPlan) meta.push(`音轨 ${audioPlan}`);
  }
  if (provider === 'video-assembly') {
    const audioFocus = normalizeText(item.audioFocus);
    if (audioFocus) meta.push(`声音 ${audioFocus.slice(0, 20)}`);
  }

  return meta.slice(0, 4);
}

function summarizePayloadGroup(group: ProviderPayloadGroup) {
  const boundCount = group.items.filter((item) => getBoundTitles(item).length > 0).length;
  const sourceMediaCount = group.items.reduce((sum, item) => sum + getSourceMediaCount(item), 0);
  const referenceCount = group.items.filter((item) => getGlobalTitles(item).length > 0).length;
  const sampleTitles = uniqueValues(group.items.flatMap((item) => getBoundTitles(item))).slice(0, 4);

  return {
    boundCount,
    sourceMediaCount,
    referenceCount,
    sampleTitles,
  };
}

function buildPreviewItems(group: ProviderPayloadGroup) {
  return [...group.items]
    .sort((left, right) => {
      const boundDiff = getBoundTitles(right).length - getBoundTitles(left).length;
      if (boundDiff !== 0) return boundDiff;
      const sourceDiff = getSourceMediaCount(right) - getSourceMediaCount(left);
      if (sourceDiff !== 0) return sourceDiff;
      return getPayloadLabel(left).localeCompare(getPayloadLabel(right), 'zh-CN');
    })
    .slice(0, 3);
}

export async function RenderPayloadPreview({ projectId }: { projectId: string }) {
  const payloadExport = await exportProviderPayloads(projectId).catch(() => null);

  if (!payloadExport) {
    return (
      <div className="asset-grid">
        <div className="asset-tile">
          <span className="label">载荷预检</span>
          <h4>Provider 载荷读取失败</h4>
          <p>当前暂时无法生成 payload 预览，可稍后重试，或直接打开原始 Provider JSON 做联调。</p>
        </div>
      </div>
    );
  }

  const groups = getPayloadGroups(
    payloadExport.providers as Record<string, unknown>,
    (payloadExport as { providerProfiles?: Record<string, unknown> }).providerProfiles || null,
  );

  return (
    <div className="page-stack">
      <div className="asset-grid three-up">
        {groups.map((group) => {
          const summary = summarizePayloadGroup(group);
          return (
            <div key={group.provider} className="asset-tile">
              <span className="label">载荷预检</span>
              <h4>{getRenderProviderLabel(group.provider)}</h4>
              <p>当前共有 {group.items.length} 条载荷，其中 {summary.boundCount} 条已带精确定向参考，{summary.referenceCount} 条带全局参考画像。</p>
              <div className="meta-list">
                <span>供应商：{getProviderName(group.profile)}</span>
                <span>模型：{getProviderModel(group.profile)}</span>
                <span>模式：{getProviderMode(group.profile) === 'remote' ? '真实执行' : '模拟执行'}</span>
                <span>定向参考：{summary.boundCount}</span>
                <span>参考源命中：{summary.sourceMediaCount}</span>
                <span>样例数：{Math.min(group.items.length, 3)}</span>
              </div>
              {summary.sampleTitles.length > 0 ? (
                <div className="tag-list">
                  {summary.sampleTitles.map((title) => (
                    <span key={`${group.provider}-${title}`} className="tag-chip">{title}</span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="asset-grid">
        {groups.flatMap((group) => buildPreviewItems(group).map((item, index) => {
          const boundTitles = getBoundTitles(item);
          const globalTitles = getGlobalTitles(item);
          const meta = getPayloadMeta(group.provider, item);
          return (
            <div key={`${group.provider}-${normalizeText(item.shotId) || normalizeText(item.sceneId) || index}`} className="asset-tile scene-tile">
              <span className="label">{getRenderProviderLabel(group.provider)}</span>
              <h4>{getPayloadLabel(item)}</h4>
              <p>{getPayloadSummary(group.provider, item)}</p>
              <div className="meta-list">
                <span>{getPayloadContext(item)}</span>
                <span>供应商 {getProviderName(group.profile, item)}</span>
                <span>模型 {getProviderModel(group.profile, item)}</span>
                <span>参考源 {getSourceMediaCount(item)}</span>
                {meta.map((entry) => <span key={`${group.provider}-${entry}`}>{entry}</span>)}
              </div>
              {boundTitles.length > 0 ? (
                <>
                  <div className="tag-list">
                    {boundTitles.map((title) => (
                      <span key={`${group.provider}-bound-${title}`} className="tag-chip">直绑：{title}</span>
                    ))}
                  </div>
                  {normalizeText(item.boundReferencePromptLine) ? <p><strong>定向提示：</strong>{normalizeText(item.boundReferencePromptLine)}</p> : null}
                  {normalizeText(item.boundReferenceNote) ? <p><strong>绑定说明：</strong>{normalizeText(item.boundReferenceNote)}</p> : null}
                </>
              ) : globalTitles.length > 0 ? (
                <div className="tag-list">
                  {globalTitles.slice(0, 4).map((title) => (
                    <span key={`${group.provider}-global-${title}`} className="tag-chip">全局：{title}</span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }))}
      </div>

      <div className="asset-grid three-up">
        <div className="asset-tile">
          <span className="label">联调建议</span>
          <h4>先看页面，再看 JSON</h4>
          <p>建议先在这里确认镜头 / 场次、定向参考和情绪时长都正常，再去打开完整 Provider JSON 做接口联调。</p>
        </div>
        <div className="asset-tile">
          <span className="label">参考联动</span>
          <h4>绑定缺口可立刻回改</h4>
          <p>如果这里看不到“直绑”标签，说明当前仍主要依赖全局参考画像，建议回到参考实验室补做镜头或分场绑定。</p>
          <Link href={buildProjectHref('/reference-lab', projectId)} className="button-ghost">返回参考实验室</Link>
        </div>
        <div className="asset-tile">
          <span className="label">执行联动</span>
          <h4>导出 / 诊断一体化</h4>
          <p>确认 payload 没问题后，再去执行渲染任务；跑完以后可直接到运行诊断查看 request / response 工件。</p>
          <div className="action-row wrap-row compact-row">
            <Link href={buildProjectHref('/render-runs', projectId)} className="button-ghost">查看运行诊断</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
