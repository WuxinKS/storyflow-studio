export function getProjectStageLabel(stage: string) {
  if (stage === 'IDEA') return '创意阶段';
  if (stage === 'STORY') return '故事阶段';
  if (stage === 'ADAPTATION') return '改编阶段';
  if (stage === 'STORYBOARD') return '分镜阶段';
  if (stage === 'RENDER') return '生成阶段';
  return stage || '未设定';
}

export function getOutputTypeLabel(output: string) {
  if (output === 'novel') return '小说';
  if (output === 'screenplay') return '剧本';
  if (output === 'video') return '视频';
  return output || '未设定';
}

export function getReferenceSourceTypeLabel(type: string) {
  if (type === 'image') return '图片';
  if (type === 'video') return '视频';
  return type || '未知类型';
}

export function getRenderJobStatusLabel(status: string) {
  if (status === 'queued') return '排队中';
  if (status === 'running') return '执行中';
  if (status === 'done') return '已完成';
  if (status === 'failed') return '失败';
  return status || '未知状态';
}

export function getRenderExecutionModeLabel(mode: string) {
  if (mode === 'remote') return '真实执行';
  if (mode === 'mock') return '模拟执行';
  return mode || '未知模式';
}

export function getRenderProviderLabel(provider: string | null | undefined) {
  if (provider === 'image-sequence') return '图像序列';
  if (provider === 'voice-synthesis') return '语音合成';
  if (provider === 'video-assembly') return '视频拼装';
  return provider || '未知 Provider';
}

export function getTimelineBeatTypeLabel(type: string | null | undefined) {
  if (type === 'buffer') return '缓冲场';
  if (type === 'key-scene') return '关键场';
  if (type === 'conflict-peak') return '冲突峰值';
  if (type === 'climax') return '高潮点';
  return '未标记';
}

export function getQaCheckToneLabel(tone: 'pass' | 'blocker' | 'warning' | 'info') {
  if (tone === 'pass') return '通过';
  if (tone === 'blocker') return '阻断';
  if (tone === 'warning') return '警告';
  return '提示';
}
