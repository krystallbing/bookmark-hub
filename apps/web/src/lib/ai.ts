import { createProvider, type AIProvider } from '@bookmark-hub/ai';
import type { AIProviderConfig } from '@bookmark-hub/shared';
import { DEFAULT_SETTINGS } from '@bookmark-hub/shared';
import { getDB } from './db';

export function getAIProvider(): AIProvider {
  const db = getDB();
  const configStr = db.getSetting('aiProvider');
  const config: AIProviderConfig = configStr
    ? JSON.parse(configStr)
    : DEFAULT_SETTINGS.aiProvider;
  return createProvider(config);
}
