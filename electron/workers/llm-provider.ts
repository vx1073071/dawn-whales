// T74: LLM Provider Abstraction
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  model?: string;
  finishReason?: string;
}

export interface LLMProvider {
  name: string;
  models: string[];
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream?(request: LLMRequest): AsyncGenerator<string>;
}

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();
  private activeProvider: string | null = null;

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  setActive(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not registered`);
    }
    this.activeProvider = name;
  }

  getActive(): LLMProvider | null {
    if (!this.activeProvider) return null;
    return this.providers.get(this.activeProvider) || null;
  }

  get(name: string): LLMProvider | null {
    return this.providers.get(name) || null;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.getActive();
    if (!provider) throw new Error('No active LLM provider');
    return provider.chat(request);
  }

  async chatStream(request: LLMRequest): Promise<AsyncGenerator<string>> {
    const provider = this.getActive();
    if (!provider || !provider.chatStream) {
      throw new Error('Streaming not available');
    }
    return provider.chatStream({ ...request, stream: true });
  }
}

export const llmRegistry = new LLMRegistry();

// Mock provider for testing/local use
export class MockLLMProvider implements LLMProvider {
  name = 'mock';
  models = ['mock-v1'];

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const lastMsg = request.messages[request.messages.length - 1]?.content || '';
    return {
      content: `Mock response to: "${lastMsg.slice(0, 100)}"`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-v1',
      finishReason: 'stop',
    };
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<string> {
    const words = ['Mock', 'streaming', 'response', '.'];
    for (const w of words) {
      yield w + ' ';
      await new Promise(r => setTimeout(r, 1));
    }
  }
}
