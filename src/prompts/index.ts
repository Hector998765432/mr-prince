import { tsunderePrompt } from './tsundere';
import { loveTsunderePrompt } from './loveTsundere';
import { systemPrompt } from './basePrompt';
import { femboyPrompt } from './femboyPrompt';

export type PromptType = 'tsundere' | 'loveTsundere' | 'femboy' | 'default';

export const getPrompt = (type: PromptType): string => {
  switch (type) {
    case 'tsundere':
      return tsunderePrompt;
    case 'loveTsundere':
      return loveTsunderePrompt;
    case 'femboy':
      return femboyPrompt;
    case 'default':
    default:
      return systemPrompt;
  }
};

export { tsunderePrompt, loveTsunderePrompt, systemPrompt };

