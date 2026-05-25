const AI_COMPANY_NAMES = [
  'openai', 'anthropic', 'deepmind', 'xai', 'runway', 'ideogram',
  'krea', 'coframe', 'together ai', 'udio', 'harvey ai', 'writer',
  'scale ai', 'sierra ai', 'figure ai', 'fireworks ai', 'factory',
  'twelve labs', 'noise labs', 'tessera labs', 'synthesia', 'descript',
  'suno', 'lindy', 'glean', 'typeface', 'augment code', 'codeium',
  'applied labs', 'arize ai', 'deepgram', 'braintrust',
  // New AI companies
  'vapi', 'hugging face', 'replicate', 'pika', 'heygen', 'hedra',
  'captions', 'moonvalley', 'cognition', 'mistral', 'cohere', 'perplexity',
  'elevenlabs', 'luma ai', 'cursor', 'weights & biases', 'modal',
  'anyscale', 'coreweave', 'stability ai', 'inflection', 'character.ai',
  'adept', 'midjourney', 'jasper', 'copy.ai', 'pinecone', 'weaviate',
];

export function isAIFromCurated(companyName: string): boolean {
  const lower = companyName.toLowerCase();
  return AI_COMPANY_NAMES.some(n => lower.includes(n));
}
