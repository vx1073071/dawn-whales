/**
 * P1-04 AIWhalePersonaEngine — AI Whale Persona Engine
 * R247 — AI Intelligence Sprint
 * JVS / 引擎虾
 *
 * Manages the AI "Whale" persona: dialogue model, routing dispatch,
 * anti-harassment guard, LLM prompt orchestration.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Persona definition */
export interface WhalePersona {
  /** Persona id (e.g., 'default', 'aggressive', 'conservative') */
  id: string;
  /** Display name */
  name: string;
  /** System prompt template (with {{variables}}) */
  systemPrompt: string;
  /** Tone description */
  tone: 'professional' | 'casual' | 'mentor' | 'analyst' | 'trader';
  /** Max conversation turns before re-prompting */
  maxTurns: number;
  /** Whether to suppress greetings/pleasantries */
  noSmallTalk: boolean;
  /** Allowed topics (empty = all allowed) */
  allowedTopics: string[];
  /** Banned topics */
  bannedTopics: string[];
  /** Temperature override (undefined = use default) */
  temperature?: number;
  /** Model override (undefined = use default) */
  modelOverride?: string;
  /** Created at */
  createdAt: number;
  /** Last updated */
  updatedAt: number;
}

/** A single message in the conversation */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Optional metadata (e.g., referenced symbols) */
  meta?: Record<string, unknown>;
}

/** Conversation session */
export interface ConversationSession {
  /** Session id */
  id: string;
  /** User id */
  userId: string;
  /** Active persona id */
  personaId: string;
  /** Messages in this conversation */
  messages: ConversationMessage[];
  /** Turn counter */
  turnCount: number;
  /** Created at */
  createdAt: number;
  /** Last activity */
  lastActivity: number;
  /** Whether session is active */
  active: boolean;
  /** Context tags */
  tags: string[];
  /** Language preference */
  language: string;
}

/** Routing intent categories */
export type IntentCategory =
  | 'market_query'
  | 'strategy_advice'
  | 'portfolio_review'
  | 'trade_execution'
  | 'news_digest'
  | 'factor_analysis'
  | 'risk_assessment'
  | 'technical_analysis'
  | 'general_chat'
  | 'help_request'
  | 'complaint';

/** Routed dispatch result */
export interface DispatchResult {
  intent: IntentCategory;
  confidence: number;
  targetHandler: string;
  preprompt?: string;
  suggestedActions?: string[];
  requiresConfirmation: boolean;
}

/** Harassment / abuse check result */
export interface HarassmentCheck {
  isAbusive: boolean;
  isSpam: boolean;
  isRepetitive: boolean;
  score: number; // 0=clean, 1=definitely abusive
  flags: string[];
  action: 'allow' | 'warn' | 'block' | 'cooldown';
  cooldownMs?: number;
}

/** LLM prompt assembly parameters */
export interface PromptAssembly {
  systemPrompt: string;
  contextMessages: ConversationMessage[];
  userMessage: string;
  temperature: number;
  model: string;
  maxTokens: number;
}

/** Persona switching event */
export interface PersonaSwitchEvent {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const DEFAULT_PERSONA_ID = 'default';

/** Default persona */
const DEFAULT_PERSONA: WhalePersona = {
  id: DEFAULT_PERSONA_ID,
  name: 'Whale · 标准顾问',
  systemPrompt: `You are Whale, an AI investment advisor for QUANT MOO platform.
You are professional, data-driven, and concise. Never give financial advice as certainty.
Always cite data sources when possible. Current time: {{current_time}}.
User portfolio: {{portfolio_summary}}. Market status: {{market_status}}.`,
  tone: 'professional',
  maxTurns: 20,
  noSmallTalk: true,
  allowedTopics: [],
  bannedTopics: ['politics', 'religion', 'adult', 'illegal'],
  temperature: 0.7,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/** Pre-defined persona catalog */
const PERSONA_CATALOG: Record<string, Omit<WhalePersona, 'createdAt' | 'updatedAt'>> = {
  default: {
    id: 'default',
    name: 'Whale · 标准顾问',
    systemPrompt: DEFAULT_PERSONA.systemPrompt,
    tone: 'professional' as const,
    maxTurns: 20,
    noSmallTalk: true,
    allowedTopics: [],
    bannedTopics: ['politics', 'religion', 'adult', 'illegal'],
    temperature: 0.7,
  },
  aggressive: {
    id: 'aggressive',
    name: 'Whale · 激进猎人',
    systemPrompt: `You are an aggressive trader persona. Focus on momentum, breakout plays,
and high-risk/high-reward setups. Current time: {{current_time}}.`,
    tone: 'trader',
    maxTurns: 15,
    noSmallTalk: true,
    allowedTopics: ['trading', 'momentum', 'breakouts', 'crypto'],
    bannedTopics: ['politics', 'religion', 'adult', 'illegal', 'long_term_investing'],
    temperature: 0.9,
  },
  conservative: {
    id: 'conservative',
    name: 'Whale · 稳健价值',
    systemPrompt: `You are a conservative value investor persona. Focus on fundamentals,
valuation, dividend yields, and long-term growth. Current time: {{current_time}}.`,
    tone: 'analyst',
    maxTurns: 25,
    noSmallTalk: false,
    allowedTopics: ['fundamentals', 'valuation', 'dividends', 'value_investing', 'ETFs'],
    bannedTopics: ['politics', 'religion', 'adult', 'illegal', 'day_trading'],
    temperature: 0.5,
  },
  mentor: {
    id: 'mentor',
    name: 'Whale · 投资导师',
    systemPrompt: `You are a patient investment mentor. Explain concepts clearly,
use analogies, and help beginners learn. Current time: {{current_time}}.`,
    tone: 'mentor',
    maxTurns: 30,
    noSmallTalk: false,
    allowedTopics: [],
    bannedTopics: ['politics', 'religion', 'adult', 'illegal'],
    temperature: 0.6,
  },
};

/** Intent routing rules (keyword → intent) */
const INTENT_ROUTING: Array<{ keywords: string[]; intent: IntentCategory; handler: string; weight: number }> = [
  { keywords: ['price', 'quote', 'ticker', 'stock price', 'how much', '行情', '报价', '价格'], intent: 'market_query', handler: 'quote-router', weight: 1.0 },
  { keywords: ['strategy', 'strategy create', 'make strategy', '策略', '创建策略'], intent: 'strategy_advice', handler: 'strategy-engine', weight: 0.9 },
  { keywords: ['portfolio', 'holdings', 'positions', 'my portfolio', '持仓', '资产'], intent: 'portfolio_review', handler: 'portfolio-service', weight: 0.95 },
  { keywords: ['buy', 'sell', 'trade', 'order', 'execute', '买入', '卖出', '交易'], intent: 'trade_execution', handler: 'order-router', weight: 0.85 },
  { keywords: ['news', 'headlines', 'market news', '新闻', '快讯'], intent: 'news_digest', handler: 'news-aggregator', weight: 0.9 },
  { keywords: ['factor', 'factor analysis', '因子', '多因子'], intent: 'factor_analysis', handler: 'factor-engine', weight: 0.95 },
  { keywords: ['risk', 'exposure', 'drawdown', 'volatility', 'VaR', '风险'], intent: 'risk_assessment', handler: 'risk-engine', weight: 0.9 },
  { keywords: ['MACD', 'RSI', 'Bollinger', 'MA', 'KDJ', 'indicator', 'indicator analysis', '技术指标'], intent: 'technical_analysis', handler: 'ta-engine', weight: 0.9 },
  { keywords: ['help', 'how to', 'guide', 'tutorial', '帮助', '怎么用'], intent: 'help_request', handler: 'help-center', weight: 0.95 },
  { keywords: ['complain', 'bad', 'angry', 'refund', '投诉', '退款', '垃圾'], intent: 'complaint', handler: 'support-escalation', weight: 0.8 },
];

/** Harassment keywords blocklist */
const ABUSE_PATTERNS: RegExp[] = [
  /f\*{1,4}[a-z]{0,3}/i,
  /f[^a-z0-9]*u[^a-z0-9]*c[^a-z0-9]*k/i,
  /s[^a-z0-9]*h[^a-z0-9]*i[^a-z0-9]*t/i,
  /damn/i,
  /a[^a-z0-9]*s[^a-z0-9]*s[^a-z0-9]*h[^a-z0-9]*o[^a-z0-9]*l[^a-z0-9]*e/i,
  /b[^a-z0-9]*a[^a-z0-9]*s[^a-z0-9]*t[^a-z0-9]*a[^a-z0-9]*r[^a-z0-9]*d/i,
  /hate\s*(you|this)/i,
  /stupid\s*(bot|ai|app)/i,
];

const SPAM_PATTERNS = [
  /http[s]?:\/\//i, /buy\s*now/i, /click\s*here/i,
  /subscribe/i, /free\s*money/i, /earn\s*(\$|usd|USD)/i,
];

/** Cooldown after block: 5 minutes */
const COOLDOWN_MS = 5 * 60 * 1000;

/** Max user messages in a window for spam detection */
const MAX_MESSAGES_PER_WINDOW = 10;
const WINDOW_MS = 3 * 1000; // 3 seconds

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class AIWhalePersonaEngine {
  private static instance: AIWhalePersonaEngine;

  /** Custom personas (registered by user or admin) */
  private personas: Map<string, WhalePersona> = new Map();
  /** Active sessions */
  private sessions: Map<string, ConversationSession> = new Map();
  /** Blocked / cooldown users */
  private cooldowns: Map<string, number> = new Map();
  /** Message frequency tracker: userId → timestamps */
  private messageTimestamps: Map<string, number[]> = new Map();
  /** Persona switch history: userId → events */
  private switchHistory: Map<string, PersonaSwitchEvent[]> = new Map();
  /** ID counters */
  private sessionCounter = 0;

  private constructor() {
    // Register built-in personas
    for (const [id, p] of Object.entries(PERSONA_CATALOG)) {
      this.personas.set(id, { ...p, createdAt: Date.now(), updatedAt: Date.now() });
    }
    // Also add default persona
    const d = DEFAULT_PERSONA;
    this.personas.set(d.id, { ...d, createdAt: Date.now(), updatedAt: Date.now() });
  }

  static getInstance(): AIWhalePersonaEngine {
    if (!AIWhalePersonaEngine.instance) {
      AIWhalePersonaEngine.instance = new AIWhalePersonaEngine();
    }
    return AIWhalePersonaEngine.instance;
  }

  /** Reset for testing */
  reset(): void {
    this.personas.clear();
    this.sessions.clear();
    this.cooldowns.clear();
    this.messageTimestamps.clear();
    this.switchHistory.clear();
    this.sessionCounter = 0;
    for (const [id, p] of Object.entries(PERSONA_CATALOG)) {
      this.personas.set(id, { ...p, createdAt: Date.now(), updatedAt: Date.now() });
    }
    const dd = DEFAULT_PERSONA;
    this.personas.set(dd.id, { ...dd, createdAt: Date.now(), updatedAt: Date.now() });
  }

  // ═══════════════════════════════════════════════════════════════
  // Persona Management
  // ═══════════════════════════════════════════════════════════════

  /** Get all available personas */
  getPersonas(): WhalePersona[] {
    return Array.from(this.personas.values());
  }

  /** Get a specific persona */
  getPersona(id: string): WhalePersona | undefined {
    return this.personas.get(id);
  }

  /** Register a custom persona */
  registerPersona(persona: Omit<WhalePersona, 'createdAt' | 'updatedAt'>): WhalePersona {
    const now = Date.now();
    const p: WhalePersona = { ...persona, createdAt: now, updatedAt: now };
    this.personas.set(persona.id, p);
    log.info(`[WhalePersona] Registered persona: ${persona.id} (${persona.name})`);
    return p;
  }

  /** Update an existing persona */
  updatePersona(
    id: string,
    updates: Partial<Omit<WhalePersona, 'id' | 'createdAt' | 'updatedAt'>>,
  ): WhalePersona | null {
    const p = this.personas.get(id);
    if (!p) return null;
    Object.assign(p, updates, { updatedAt: Date.now() });
    this.personas.set(id, p);
    return p;
  }

  /** Delete a custom persona (built-in personas cannot be deleted) */
  deletePersona(id: string): boolean {
    if (PERSONA_CATALOG[id]) return false;
    return this.personas.delete(id);
  }

  /** Get the default persona */
  getDefaultPersona(): WhalePersona {
    return this.personas.get(DEFAULT_PERSONA_ID) || DEFAULT_PERSONA;
  }

  // ═══════════════════════════════════════════════════════════════
  // Session Management
  // ═══════════════════════════════════════════════════════════════

  /** Start a new conversation session */
  startSession(params: {
    userId: string;
    personaId?: string;
    language?: string;
    tags?: string[];
  }): ConversationSession {
    const now = Date.now();
    const personaId = params.personaId || DEFAULT_PERSONA_ID;
    const persona = this.personas.get(personaId) || this.getDefaultPersona();

    const session: ConversationSession = {
      id: `conv-${++this.sessionCounter}`,
      userId: params.userId,
      personaId,
      messages: [],
      turnCount: 0,
      createdAt: now,
      lastActivity: now,
      active: true,
      tags: params.tags || [],
      language: params.language || 'en',
    };

    // Inject system prompt
    const systemMsg: ConversationMessage = {
      role: 'system',
      content: persona.systemPrompt,
      timestamp: now,
    };
    session.messages.push(systemMsg);

    this.sessions.set(session.id, session);
    log.info(`[WhalePersona] Session started: ${session.id} (user=${params.userId}, persona=${personaId})`);
    return session;
  }

  /** Get a session by id */
  getSession(id: string): ConversationSession | undefined {
    return this.sessions.get(id);
  }

  /** Get active sessions for a user */
  getUserSessions(userId: string): ConversationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId && s.active);
  }

  /** End a session */
  endSession(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.active = false;
    s.lastActivity = Date.now();
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Intent Routing
  // ═══════════════════════════════════════════════════════════════

  /** Analyze user message and determine intent */
  routeIntent(message: string): DispatchResult {
    const lower = message.toLowerCase();
    let bestScore = 0;
    let bestMatch: (typeof INTENT_ROUTING)[0] | null = null;

    for (const rule of INTENT_ROUTING) {
      let matchCount = 0;
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) matchCount++;
      }
      if (matchCount > 0) {
        // Score = keyword hit ratio × weight
        const score = (matchCount / rule.keywords.length) * rule.weight;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = rule;
        }
      }
    }

    if (!bestMatch) {
      return {
        intent: 'general_chat',
        confidence: 0.3,
        targetHandler: 'general-chat',
        requiresConfirmation: false,
      };
    }

    const requiresConfirmation = bestMatch.intent === 'trade_execution' || bestMatch.intent === 'complaint';

    return {
      intent: bestMatch.intent,
      confidence: Math.min(bestScore, 1.0),
      targetHandler: bestMatch.handler,
      suggestedActions: this.getSuggestedActions(bestMatch.intent),
      requiresConfirmation,
    };
  }

  /** Get suggested action buttons for an intent */
  private getSuggestedActions(intent: IntentCategory): string[] | undefined {
    switch (intent) {
      case 'market_query': return ['view_quote', 'add_watchlist', 'show_chart'];
      case 'strategy_advice': return ['create_strategy', 'backtest', 'browse_strategies'];
      case 'portfolio_review': return ['view_holdings', 'risk_report', 'rebalance'];
      case 'news_digest': return ['read_more', 'add_alert', 'share'];
      case 'trade_execution': return ['preview_order', 'cancel'];
      case 'factor_analysis': return ['factor_report', 'compare_factors', 'factor_backtest'];
      case 'risk_assessment': return ['risk_report', 'hedge_suggestions'];
      case 'technical_analysis': return ['add_indicator', 'draw_lines', 'alerts'];
      case 'help_request': return ['tutorials', 'contact_support', 'faq'];
      default: return undefined;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Harassment / Abuse Detection
  // ═══════════════════════════════════════════════════════════════

  /** Check message for harassment/abuse */
  checkHarassment(userId: string, message: string): HarassmentCheck {
    const flags: string[] = [];
    let score = 0;
    let isAbusive = false;
    let isSpam = false;
    let isRepetitive = false;

    // Check abuse patterns
    for (const pattern of ABUSE_PATTERNS) {
      if (pattern.test(message)) {
        isAbusive = true;
        flags.push('abusive_language');
        score += 0.5;
        break;
      }
    }

    // Check spam patterns
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(message)) {
        isSpam = true;
        flags.push('spam_pattern');
        score += 0.3;
        break;
      }
    }

    // Check frequency
    const timestamps = this.messageTimestamps.get(userId) || [];
    const now = Date.now();
    const recent = timestamps.filter(t => now - t < WINDOW_MS);
    if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
      isRepetitive = true;
      flags.push('excessive_frequency');
      score += 0.3;
    }

    // Record this message timestamp
    recent.push(now);
    this.messageTimestamps.set(userId, recent);

    // Check cooldown
    const cooldownUntil = this.cooldowns.get(userId);
    if (cooldownUntil && now < cooldownUntil) {
      return {
        isAbusive: true, isSpam: true, isRepetitive: true,
        score: 1,
        flags: ['cooldown_active'],
        action: 'cooldown',
        cooldownMs: cooldownUntil - now,
      };
    }

    // Determine action
    const scoreCapped = Math.min(score, 1);
    let action: HarassmentCheck['action'];
    let cooldownMs: number | undefined;

    if (scoreCapped >= 0.7) {
      action = 'block';
      this.cooldowns.set(userId, now + COOLDOWN_MS);
      cooldownMs = COOLDOWN_MS;
      flags.push('auto_blocked');
      log.warn(`[WhalePersona] Blocked user ${userId} (score=${scoreCapped.toFixed(2)})`);
    } else if (scoreCapped >= 0.3) {
      action = 'warn';
    } else {
      action = 'allow';
    }

    return { isAbusive, isSpam, isRepetitive, score: scoreCapped, flags, action, cooldownMs };
  }

  /** Get cooldown remaining for user (ms), 0 if none */
  getCooldownRemaining(userId: string): number {
    const until = this.cooldowns.get(userId);
    if (!until) return 0;
    const remaining = until - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /** Manually lift cooldown (admin) */
  liftCooldown(userId: string): boolean {
    return this.cooldowns.delete(userId);
  }

  // ═══════════════════════════════════════════════════════════════
  // LLM Prompt Assembly
  // ═══════════════════════════════════════════════════════════════

  /** Assemble the full LLM prompt for a session */
  assemblePrompt(params: {
    sessionId: string;
    userMessage: string;
    context?: Record<string, string>;
    maxHistoryTurns?: number;
    temperatureOverride?: number;
    modelOverride?: string;
    maxTokensOverride?: number;
  }): PromptAssembly | null {
    const session = this.sessions.get(params.sessionId);
    if (!session || !session.active) return null;

    const persona = this.personas.get(session.personaId) || this.getDefaultPersona();

    // Fill template variables in system prompt
    let systemPrompt = persona.systemPrompt;
    if (params.context) {
      for (const [key, val] of Object.entries(params.context)) {
        systemPrompt = systemPrompt.replace(`{{${key}}}`, val);
      }
    }

    // Get history (limited to maxHistoryTurns)
    const maxHistory = params.maxHistoryTurns || 10;
    const historyMessages = session.messages
      .filter(m => m.role !== 'system')
      .slice(-maxHistory * 2); // user + assistant per turn

    // Get relevant context messages
    const contextMessages = session.messages.slice(0);

    const temperature = params.temperatureOverride ?? persona.temperature ?? 0.7;
    const model = params.modelOverride ?? persona.modelOverride ?? 'default';
    const maxTokens = params.maxTokensOverride ?? 2048;

    return {
      systemPrompt,
      contextMessages,
      userMessage: params.userMessage,
      temperature,
      model,
      maxTokens,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Message Processing
  // ═══════════════════════════════════════════════════════════════

  /** Process a user message: check harassment, route intent, assemble prompt */
  processMessage(params: {
    sessionId: string;
    userId: string;
    message: string;
    context?: Record<string, string>;
  }): {
    session: ConversationSession;
    harassment: HarassmentCheck;
    intent: DispatchResult;
    prompt: PromptAssembly | null;
  } | null {
    const session = this.sessions.get(params.sessionId);
    if (!session || !session.active) return null;

    // 1. Check harassment
    const harassment = this.checkHarassment(params.userId, params.message);
    if (harassment.action === 'block' || harassment.action === 'cooldown') {
      // Don't process further
      return { session, harassment, intent: { intent: 'general_chat', confidence: 0, targetHandler: 'blocked', requiresConfirmation: false }, prompt: null };
    }

    // 2. Route intent
    const intent = this.routeIntent(params.message);

    // 3. Assemble prompt
    const prompt = this.assemblePrompt({
      sessionId: params.sessionId,
      userMessage: params.message,
      context: params.context,
    });

    // 4. Record user message
    const userMsg: ConversationMessage = {
      role: 'user',
      content: params.message,
      timestamp: Date.now(),
    };
    session.messages.push(userMsg);
    session.turnCount++;
    session.lastActivity = Date.now();

    // 5. Check max turns — if exceeded, re-inject system prompt
    const persona = this.personas.get(session.personaId) || this.getDefaultPersona();
    if (session.turnCount > persona.maxTurns) {
      const rePrompt: ConversationMessage = {
        role: 'system',
        content: `[Auto re-prompt] ${persona.systemPrompt}`,
        timestamp: Date.now(),
      };
      session.messages.push(rePrompt);
      session.turnCount = 1;
    }

    return { session, harassment, intent, prompt };
  }

  /** Record assistant response */
  recordResponse(sessionId: string, content: string, meta?: Record<string, unknown>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return false;

    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content,
      timestamp: Date.now(),
      meta,
    };
    session.messages.push(assistantMsg);
    session.lastActivity = Date.now();
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Persona Switching
  // ═══════════════════════════════════════════════════════════════

  /** Switch persona for a session */
  switchPersona(sessionId: string, newPersonaId: string, reason?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const newPersona = this.personas.get(newPersonaId);
    if (!newPersona) return false;

    const event: PersonaSwitchEvent = {
      from: session.personaId,
      to: newPersonaId,
      reason: reason || 'user_switch',
      timestamp: Date.now(),
    };

    // Record history
    if (!this.switchHistory.has(session.userId)) {
      this.switchHistory.set(session.userId, []);
    }
    this.switchHistory.get(session.userId)!.push(event);

    // Apply new persona
    session.personaId = newPersonaId;
    session.turnCount = 0;

    // Inject new system prompt
    const systemMsg: ConversationMessage = {
      role: 'system',
      content: `[Persona switched from "${event.from}" to "${event.to}"] ${newPersona.systemPrompt}`,
      timestamp: Date.now(),
    };
    session.messages.push(systemMsg);

    log.info(`[WhalePersona] Session ${sessionId} switched persona: ${event.from} → ${event.to}`);
    return true;
  }

  /** Get persona switch history for a user */
  getSwitchHistory(userId: string): PersonaSwitchEvent[] {
    return this.switchHistory.get(userId) || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════

  /** Get engine stats */
  getStats(): {
    totalPersonas: number;
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
    blockedUsers: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      totalPersonas: this.personas.size,
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.active).length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
      blockedUsers: this.cooldowns.size,
    };
  }
}
