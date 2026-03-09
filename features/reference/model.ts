export type ReferenceAnalysis = {
  sourceType: 'image' | 'video';
  framing: string;
  emotion: string;
  movement: string;
};

export const sampleReferenceAnalysis: ReferenceAnalysis = {
  sourceType: 'image',
  framing: '近景特写，强调手部与面部表情',
  emotion: '压迫、恐惧、临界紧张',
  movement: '人物动作克制，但细节极强，适合 suspense 节奏',
};
