export type AssetCard = {
  id: string;
  label: string;
  category: 'character' | 'scene' | 'style';
};

export const sampleAssetCards: AssetCard[] = [
  { id: 'char-a', label: '女主主设定', category: 'character' },
  { id: 'scene-a', label: '地下实验室', category: 'scene' },
  { id: 'style-a', label: '冷峻惊悚风格卡', category: 'style' },
];
