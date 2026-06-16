/**
 * P2-07 AILearningModeEngine — AI Learning Mode Engine
 * R251 — P2 Deepening
 * JVS / 引擎虾
 *
 * Multi-mode learning system for traders: beginner/intermediate/advanced/paper-trade.
 * Adaptive difficulty, learning path recommendation, progress tracking, achievement
 * system, and trading knowledge graph navigation. Drives the AI education pipeline.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type LearningLevel = 'beginner' | 'intermediate' | 'advanced' | 'paper_trade';

export type LessonTopic =
  | 'market_basics'
  | 'technical_analysis'
  | 'fundamental_analysis'
  | 'risk_management'
  | 'trading_psychology'
  | 'strategy_design'
  | 'backtesting'
  | 'options'
  | 'futures'
  | 'crypto'
  | 'portfolio_management'
  | 'quantitative'
  | 'market_microstructure';

export type Achievement =
  | 'first_lesson'
  | 'ten_lessons'
  | 'fifty_lessons'
  | 'perfect_quiz'
  | 'three_day_streak'
  | 'seven_day_streak'
  | 'thirty_day_streak'
  | 'first_backtest'
  | 'first_strategy'
  | 'all_topics_complete'
  | 'speed_learner'
  | 'consistent_learner';

export interface Lesson {
  id: string;
  topic: LessonTopic;
  title: string;
  level: LearningLevel;
  content: string;
  durationMinutes: number;
  quizQuestions: number;
  prerequisites: string[]; // lesson IDs
  points: number;
  tags: string[];
}

export interface LearnerProfile {
  userId: string;
  currentLevel: LearningLevel;
  completedLessons: string[]; // lesson IDs
  completedQuizzes: Map<string, number>; // lessonId → score (0-100)
  streakDays: number;
  lastActivityDate: string;
  totalPoints: number;
  achievements: Achievement[];
  topicProgress: Record<LessonTopic, number>; // 0-100
  preferences: {
    preferredTopics: LessonTopic[];
    dailyGoalMinutes: number;
    difficultyBias: number; // -1 (easier) to 1 (harder)
  };
}

export interface LearningPath {
  userId: string;
  recommendedLessons: Lesson[];
  nextMilestone: Achievement;
  estimatedTimeRemaining: number; // minutes
  streakBonus: number; // extra points
  adaptiveHint: string;
}

export interface QuizResult {
  lessonId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  passed: boolean;
  feedback: string;
}

// ═══════════════════════════════════════════════════════════════
// Default Lesson Catalog
// ═══════════════════════════════════════════════════════════════

const LESSON_CATALOG: Lesson[] = [
  // Beginner
  { id: 'L001', topic: 'market_basics', title: 'What is a Stock Market?', level: 'beginner', content: '', durationMinutes: 10, quizQuestions: 5, prerequisites: [], points: 10, tags: ['stocks', 'intro'] },
  { id: 'L002', topic: 'market_basics', title: 'Bulls, Bears, and Market Cycles', level: 'beginner', content: '', durationMinutes: 12, quizQuestions: 5, prerequisites: ['L001'], points: 10, tags: ['cycles', 'sentiment'] },
  { id: 'L003', topic: 'technical_analysis', title: 'Reading Candlestick Charts', level: 'beginner', content: '', durationMinutes: 15, quizQuestions: 6, prerequisites: ['L001'], points: 15, tags: ['charts', 'candlesticks'] },
  { id: 'L004', topic: 'risk_management', title: 'Introduction to Risk Management', level: 'beginner', content: '', durationMinutes: 12, quizQuestions: 5, prerequisites: ['L001'], points: 15, tags: ['risk', 'intro'] },
  { id: 'L005', topic: 'trading_psychology', title: 'Emotions and Trading', level: 'beginner', content: '', durationMinutes: 10, quizQuestions: 4, prerequisites: ['L001'], points: 10, tags: ['psychology', 'intro'] },

  // Intermediate
  { id: 'L006', topic: 'technical_analysis', title: 'Moving Averages Deep Dive', level: 'intermediate', content: '', durationMinutes: 20, quizQuestions: 8, prerequisites: ['L003'], points: 25, tags: ['MA', 'trend'] },
  { id: 'L007', topic: 'technical_analysis', title: 'MACD and RSI Strategies', level: 'intermediate', content: '', durationMinutes: 20, quizQuestions: 8, prerequisites: ['L003'], points: 25, tags: ['oscillators', 'momentum'] },
  { id: 'L008', topic: 'fundamental_analysis', title: 'Reading Financial Statements', level: 'intermediate', content: '', durationMinutes: 25, quizQuestions: 10, prerequisites: ['L001'], points: 30, tags: ['fundamentals', 'balance-sheet'] },
  { id: 'L009', topic: 'risk_management', title: 'Position Sizing and Kelly Criterion', level: 'intermediate', content: '', durationMinutes: 20, quizQuestions: 7, prerequisites: ['L004'], points: 25, tags: ['position-sizing', 'kelly'] },
  { id: 'L010', topic: 'strategy_design', title: 'Building Your First Trading Strategy', level: 'intermediate', content: '', durationMinutes: 25, quizQuestions: 10, prerequisites: ['L006', 'L007'], points: 30, tags: ['strategy', 'design'] },

  // Advanced
  { id: 'L011', topic: 'quantitative', title: 'Introduction to Quantitative Trading', level: 'advanced', content: '', durationMinutes: 30, quizQuestions: 12, prerequisites: ['L010'], points: 40, tags: ['quant', 'algorithms'] },
  { id: 'L012', topic: 'options', title: 'Options Greeks and Pricing', level: 'advanced', content: '', durationMinutes: 35, quizQuestions: 15, prerequisites: ['L008'], points: 45, tags: ['options', 'greeks'] },
  { id: 'L013', topic: 'backtesting', title: 'Advanced Backtesting Methodologies', level: 'advanced', content: '', durationMinutes: 30, quizQuestions: 10, prerequisites: ['L010', 'L011'], points: 40, tags: ['backtesting', 'validation'] },
  { id: 'L014', topic: 'market_microstructure', title: 'Order Flow and Market Depth', level: 'advanced', content: '', durationMinutes: 30, quizQuestions: 12, prerequisites: ['L011'], points: 40, tags: ['order-flow', 'microstructure'] },
  { id: 'L015', topic: 'portfolio_management', title: 'Modern Portfolio Theory Applied', level: 'advanced', content: '', durationMinutes: 30, quizQuestions: 10, prerequisites: ['L009', 'L008'], points: 40, tags: ['portfolio', 'MPT'] },
];

// ═══════════════════════════════════════════════════════════════
// Achievement Definitions
// ═══════════════════════════════════════════════════════════════

const ACHIEVEMENT_DEFS: Record<Achievement, { name: string; description: string; points: number }> = {
  first_lesson: { name: 'First Steps', description: 'Complete your first lesson', points: 5 },
  ten_lessons: { name: 'Dedicated Student', description: 'Complete 10 lessons', points: 20 },
  fifty_lessons: { name: 'Scholar', description: 'Complete 50 lessons', points: 100 },
  perfect_quiz: { name: 'Perfect Score', description: 'Score 100% on any quiz', points: 30 },
  three_day_streak: { name: '3-Day Streak', description: 'Study 3 consecutive days', points: 15 },
  seven_day_streak: { name: 'Weekly Warrior', description: 'Study 7 consecutive days', points: 40 },
  thirty_day_streak: { name: 'Monthly Master', description: 'Study 30 consecutive days', points: 150 },
  first_backtest: { name: 'Backtester', description: 'Complete backtesting lesson', points: 25 },
  first_strategy: { name: 'Strategy Architect', description: 'Complete strategy design lesson', points: 25 },
  all_topics_complete: { name: 'Renaissance Trader', description: 'Complete at least 1 lesson in all topics', points: 200 },
  speed_learner: { name: 'Speed Learner', description: 'Complete a quiz in under 60s with 80%+', points: 20 },
  consistent_learner: { name: 'Consistent Learner', description: 'Maintain 7 day streak', points: 40 },
};

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class AILearningModeEngine {
  private static instance: AILearningModeEngine;

  private lessons: Map<string, Lesson> = new Map();
  private profiles: Map<string, LearnerProfile> = new Map();
  private paths: Map<string, LearningPath> = new Map();
  private quizResults: Map<string, QuizResult[]> = new Map(); // userId → results

  private constructor() {
    for (const lesson of LESSON_CATALOG) {
      this.lessons.set(lesson.id, { ...lesson });
    }
  }

  static getInstance(): AILearningModeEngine {
    if (!AILearningModeEngine.instance) {
      AILearningModeEngine.instance = new AILearningModeEngine();
    }
    return AILearningModeEngine.instance;
  }

  reset(): void {
    this.lessons.clear();
    for (const lesson of LESSON_CATALOG) {
      this.lessons.set(lesson.id, { ...lesson });
    }
    this.profiles.clear();
    this.paths.clear();
    this.quizResults.clear();
  }

  // ═══════════════════════════════════════════════════════════════
  // Lesson Management
  // ═══════════════════════════════════════════════════════════════

  getLesson(id: string): Lesson | undefined {
    return this.lessons.get(id);
  }

  listLessons(level?: LearningLevel, topic?: LessonTopic): Lesson[] {
    let filtered = Array.from(this.lessons.values());
    if (level) filtered = filtered.filter(l => l.level === level);
    if (topic) filtered = filtered.filter(l => l.topic === topic);
    return filtered;
  }

  addCustomLesson(lesson: Lesson): void {
    this.lessons.set(lesson.id, { ...lesson });
    log.info(`[LearningMode] Custom lesson added: ${lesson.id}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // Learner Profile Management
  // ═══════════════════════════════════════════════════════════════

  createProfile(userId: string, preferences?: Partial<LearnerProfile['preferences']>): LearnerProfile {
    const profile: LearnerProfile = {
      userId,
      currentLevel: 'beginner',
      completedLessons: [],
      completedQuizzes: new Map(),
      streakDays: 0,
      lastActivityDate: '',
      totalPoints: 0,
      achievements: [],
      topicProgress: {
        market_basics: 0, technical_analysis: 0, fundamental_analysis: 0,
        risk_management: 0, trading_psychology: 0, strategy_design: 0,
        backtesting: 0, options: 0, futures: 0, crypto: 0,
        portfolio_management: 0, quantitative: 0, market_microstructure: 0,
      },
      preferences: {
        preferredTopics: preferences?.preferredTopics || ['market_basics'],
        dailyGoalMinutes: preferences?.dailyGoalMinutes || 30,
        difficultyBias: preferences?.difficultyBias || 0,
      },
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  getProfile(userId: string): LearnerProfile | undefined {
    return this.profiles.get(userId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Progress Tracking
  // ═══════════════════════════════════════════════════════════════

  completeLesson(userId: string, lessonId: string): LearnerProfile {
    let profile = this.profiles.get(userId);
    if (!profile) profile = this.createProfile(userId);

    const lesson = this.lessons.get(lessonId);
    if (!lesson) throw new Error(`Lesson ${lessonId} not found`);

    if (profile.completedLessons.includes(lessonId)) return profile;

    profile.completedLessons.push(lessonId);
    profile.totalPoints += lesson.points;
    profile.lastActivityDate = new Date().toISOString().slice(0, 10);

    // Update topic progress
    const topicLessons = this.listLessons(undefined, lesson.topic);
    const completedInTopic = topicLessons.filter(l => profile!.completedLessons.includes(l.id)).length;
    profile.topicProgress[lesson.topic] = Math.round((completedInTopic / topicLessons.length) * 100);

    // Check achievements
    this.grantAchievements(profile);

    // Auto-level-up
    profile.currentLevel = this.computeLevel(profile);

    this.profiles.set(userId, profile);
    log.info(`[LearningMode] ${userId} completed ${lessonId} (${profile.currentLevel}, ${profile.totalPoints}pts)`);
    return profile;
  }

  submitQuiz(userId: string, lessonId: string, answers: { correct: boolean }[], timeSpentSeconds: number): QuizResult {
    const correctAnswers = answers.filter(a => a.correct).length;
    const totalQuestions = answers.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = score >= 70;

    const feedback = passed
      ? score === 100
        ? 'Perfect! Outstanding mastery of the material.'
        : 'Great job! Review the missed questions to solidify your understanding.'
      : 'Keep studying! Review the material and try again.';

    const result: QuizResult = {
      lessonId,
      score,
      correctAnswers,
      totalQuestions,
      timeSpentSeconds,
      passed,
      feedback,
    };

    if (!this.quizResults.has(userId)) {
      this.quizResults.set(userId, []);
    }
    this.quizResults.get(userId)!.push(result);

    // Record quiz in profile
    let profile = this.profiles.get(userId);
    if (!profile) profile = this.createProfile(userId);
    profile.completedQuizzes.set(lessonId, score);

    // Check speed learner achievement
    if (timeSpentSeconds < 60 && score >= 80) {
      if (!profile.achievements.includes('speed_learner')) {
        profile.achievements.push('speed_learner');
        profile.totalPoints += ACHIEVEMENT_DEFS.speed_learner.points;
      }
    }

    this.profiles.set(userId, profile);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Streak System
  // ═══════════════════════════════════════════════════════════════

  updateStreak(userId: string, dateStr?: string): number {
    let profile = this.profiles.get(userId);
    if (!profile) profile = this.createProfile(userId);

    const date = dateStr || new Date().toISOString().slice(0, 10);

    if (!profile.lastActivityDate) {
      profile.streakDays = 1;
      profile.lastActivityDate = date;
    } else {
      const lastDate = new Date(profile.lastActivityDate);
      const currentDate = new Date(date);
      const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / 86400000);

      if (diffDays === 0) {
        // Same day, no change
      } else if (diffDays === 1) {
        profile.streakDays += 1;
        profile.lastActivityDate = date;
      } else {
        profile.streakDays = 1;
        profile.lastActivityDate = date;
      }
    }

    // Check streak achievements
    this.grantAchievements(profile);
    this.profiles.set(userId, profile);
    return profile.streakDays;
  }

  // ═══════════════════════════════════════════════════════════════
  // Achievement System
  // ═══════════════════════════════════════════════════════════════

  private grantAchievements(profile: LearnerProfile): void {
    const add = (a: Achievement) => {
      if (!profile.achievements.includes(a)) {
        profile.achievements.push(a);
      }
    };

    if (profile.completedLessons.length >= 1) add('first_lesson');
    if (profile.completedLessons.length >= 10) add('ten_lessons');
    if (profile.completedLessons.length >= 50) add('fifty_lessons');
    if (Array.from(profile.completedQuizzes.values()).some(s => s === 100)) add('perfect_quiz');
    if (profile.streakDays >= 3) add('three_day_streak');
    if (profile.streakDays >= 7) add('seven_day_streak');
    if (profile.streakDays >= 30) add('thirty_day_streak');

    // First backtest (backtesting topic)
    if (profile.topicProgress.backtesting > 0) add('first_backtest');
    // First strategy
    if (profile.topicProgress.strategy_design > 0) add('first_strategy');

    // All topics complete
    const allTopics = Object.values(profile.topicProgress).every(v => v > 0);
    if (allTopics) add('all_topics_complete');
  }

  getAchievements(userId: string): { name: string; description: string; points: number; earned: boolean }[] {
    const profile = this.profiles.get(userId);
    const earnedSet = new Set(profile?.achievements || []);
    return Object.entries(ACHIEVEMENT_DEFS).map(([key, def]) => ({
      name: def.name,
      description: def.description,
      points: def.points,
      earned: earnedSet.has(key as Achievement),
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // Learning Path Recommendation
  // ═══════════════════════════════════════════════════════════════

  generateLearningPath(userId: string): LearningPath {
    let profile = this.profiles.get(userId);
    if (!profile) profile = this.createProfile(userId);

    // Find next lessons: incomplete, prerequisites met, matching level
    const levelOrder: LearningLevel[] = ['beginner', 'intermediate', 'advanced', 'paper_trade'];
    const currentLevelIdx = levelOrder.indexOf(profile.currentLevel);

    const eligible = Array.from(this.lessons.values()).filter(l => {
      if (profile!.completedLessons.includes(l.id)) return false;
      // Check prerequisites
      for (const pre of l.prerequisites) {
        if (!profile!.completedLessons.includes(pre)) return false;
      }
      // Level check: allow current and up to one level above
      const lessonLevelIdx = levelOrder.indexOf(l.level);
      if (lessonLevelIdx > currentLevelIdx + 1) return false;
      if (lessonLevelIdx < currentLevelIdx - 1) return false;
      return true;
    });

    // Sort by: preferred topics first, then by difficulty matching
    eligible.sort((a, b) => {
      const aPref = profile!.preferences.preferredTopics.includes(a.topic) ? -1 : 1;
      const bPref = profile!.preferences.preferredTopics.includes(b.topic) ? -1 : 1;
      return aPref - bPref;
    });

    const recommended = eligible.slice(0, 5);

    // Find next milestone
    const milestones: Achievement[] = ['first_lesson', 'ten_lessons', 'fifty_lessons', 'seven_day_streak'];
    const nextMilestone = milestones.find(m => !profile.achievements.includes(m)) || 'all_topics_complete';

    // Estimate time remaining
    const estimatedTime = recommended.reduce((s, l) => s + l.durationMinutes, 0);

    // Streak bonus
    const streakBonus = Math.min(profile.streakDays * 2, 20);

    // Adaptive hint
    let adaptiveHint: string;
    if (profile.preferences.difficultyBias > 0.3) {
      adaptiveHint = 'You prefer harder material — try skipping ahead to advanced lessons.';
    } else if (profile.preferences.difficultyBias < -0.3) {
      adaptiveHint = 'Take your time with beginner lessons before moving up.';
    } else if (recommended.length === 0) {
      adaptiveHint = 'All lessons complete for your level! Consider leveling up.';
    } else {
      adaptiveHint = `Focus on ${profile.preferences.preferredTopics[0]?.replace(/_/g, ' ') || 'market basics'} today.`;
    }

    const path: LearningPath = {
      userId,
      recommendedLessons: recommended,
      nextMilestone,
      estimatedTimeRemaining: estimatedTime,
      streakBonus,
      adaptiveHint,
    };

    this.paths.set(userId, path);
    log.info(`[LearningMode] Path generated for ${userId}: ${recommended.length} lessons, ${estimatedTime}min`);
    return path;
  }

  // ═══════════════════════════════════════════════════════════════
  // Level Computation
  // ═══════════════════════════════════════════════════════════════

  private computeLevel(profile: LearnerProfile): LearningLevel {
    const total = profile.completedLessons.length;
    const beginnerComplete = this.listLessons('beginner').filter(l => profile.completedLessons.includes(l.id)).length;
    const intermediateComplete = this.listLessons('intermediate').filter(l => profile.completedLessons.includes(l.id)).length;

    if (total >= 12 && intermediateComplete >= 3) return 'advanced';
    if (total >= 5 && beginnerComplete >= 3) return 'intermediate';
    return 'beginner';
  }

  // ═══════════════════════════════════════════════════════════════
  // Knowledge Graph Navigation
  // ═══════════════════════════════════════════════════════════════

  getTopicGraph(): Map<LessonTopic, LessonTopic[]> {
    // Build adjacency from prerequisites
    const adj = new Map<LessonTopic, Set<LessonTopic>>();

    for (const [, lesson] of this.lessons) {
      if (!adj.has(lesson.topic)) adj.set(lesson.topic, new Set());
      for (const preId of lesson.prerequisites) {
        const preLesson = this.lessons.get(preId);
        if (preLesson && preLesson.topic !== lesson.topic) {
          adj.get(lesson.topic)!.add(preLesson.topic);
        }
      }
    }

    const graph = new Map<LessonTopic, LessonTopic[]>();
    for (const [topic, deps] of adj) {
      graph.set(topic, Array.from(deps));
    }
    return graph;
  }

  getTopicStats(userId: string): { topic: LessonTopic; progress: number; completedCount: number; totalCount: number }[] {
    const profile = this.profiles.get(userId);
    const topics = new Set<LessonTopic>();
    for (const [, lesson] of this.lessons) topics.add(lesson.topic);

    return Array.from(topics).map(topic => {
      const all = this.listLessons(undefined, topic);
      const completed = all.filter(l => profile?.completedLessons.includes(l.id)).length;
      return {
        topic,
        progress: all.length > 0 ? Math.round((completed / all.length) * 100) : 0,
        completedCount: completed,
        totalCount: all.length,
      };
    });
  }
}
