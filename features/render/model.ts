export type RenderTask = {
  id: string;
  provider: string;
  status: 'queued' | 'running' | 'done';
};

export const sampleRenderTasks: RenderTask[] = [
  { id: 'render-1', provider: 'video-provider', status: 'queued' },
  { id: 'render-2', provider: 'voice-provider', status: 'running' },
];
