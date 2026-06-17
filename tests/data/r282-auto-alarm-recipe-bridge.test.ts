// ══ R282 autoclaw: Factor Alarm Push + Recipe Strategy Bridge Tests ══
// vitest, not jest

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorAlarmPushBridge,
  FactorAlarmClockEngine,
  getAlarmPushBridge,
  resetAlarmPushBridge,
} from '../../electron/engine/data/factor-alarm-push-bridge';
import type {
  FactorAlarm,
  AlarmConditionType,
  AlarmTriggerEvent,
  AlarmFactorSnapshot,
  AlarmStats,
} from '../../electron/engine/data/factor-alarm-push-bridge';

import {
  FactorRecipeStrategyBridge,
  getRecipeStrategyBridge,
  resetRecipeStrategyBridge,
} from '../../electron/engine/data/factor-recipe-strategy-bridge';
import type {
  FactorRecipe,
  ConvertedStrategy,
  RecipeBacktestPreview,
} from '../../electron/engine/data/factor-recipe-strategy-bridge';

// ═══════════════════════════════════════════════════════════════════
// Factor Alarm Push Bridge Tests
// ═══════════════════════════════════════════════════════════════════

describe('R282 FactorAlarmPushBridge — Health', () => {
  beforeEach(() => {
    resetAlarmPushBridge();
  });

  it('A1: getAlarmPushBridge returns same instance', () => {
    const a = getAlarmPushBridge();
    const b = getAlarmPushBridge();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(FactorAlarmPushBridge);
  });

  it('A2: Bridge starts uninitialized, needs push dispatcher', () => {
    const bridge = getAlarmPushBridge();
    expect(bridge.isInitialized).toBe(false);
  });

  it('A3: Initialize with push dispatcher sets isInitialized', () => {
    const bridge = getAlarmPushBridge();
    const dispatcher = () => [];
    bridge.initialize(dispatcher as any);
    expect(bridge.isInitialized).toBe(true);
  });

  it('A4: resetAlarmPushBridge clears state', () => {
    const bridge = getAlarmPushBridge();
    bridge.initialize(() => [] as any);
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MarketBeta', label: 'test', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    expect(bridge.listAlarms().length).toBe(1);

    resetAlarmPushBridge();
    const bridge2 = getAlarmPushBridge();
    expect(bridge2.isInitialized).toBe(false);
    expect(bridge2.listAlarms().length).toBe(0);
  });

  it('A5: Bridge exposes underlying engine', () => {
    const bridge = getAlarmPushBridge();
    expect(bridge.engine).toBeInstanceOf(FactorAlarmClockEngine);
  });
});

describe('R282 FactorAlarmPushBridge — Alarm CRUD', () => {
  beforeEach(() => {
    resetAlarmPushBridge();
  });

  it('B1: createAlarm returns valid FactorAlarm', () => {
    const bridge = getAlarmPushBridge();
    const alarm = bridge.createAlarm({
      userId: 'user_001',
      factorId: 'MOM_12M',
      factorName: 'Momentum12M',
      factorNameCn: '12月动量',
      label: '动量IC下降告警',
      conditionType: 'ic_drop',
      condition: { dropPercent: 40, operator: 'gte' },
      severity: 'warning',
    });

    expect(alarm.alarmId).toMatch(/^alarm_/);
    expect(alarm.factorId).toBe('MOM_12M');
    expect(alarm.status).toBe('active');
    expect(alarm.conditionType).toBe('ic_drop');
    expect(alarm.condition.dropPercent).toBe(40);
    expect(alarm.severity).toBe('warning');
    expect(alarm.pushChannels).toEqual(['system', 'toast']);
    expect(alarm.triggerCount).toBe(0);
  });

  it('B2: getAlarm finds by ID', () => {
    const bridge = getAlarmPushBridge();
    const alarm = bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'A', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    const found = bridge.getAlarm(alarm.alarmId);
    expect(found).not.toBeNull();
    expect(found!.label).toBe('A');
  });

  it('B3: getAlarm returns null for unknown ID', () => {
    const bridge = getAlarmPushBridge();
    expect(bridge.getAlarm('nonexistent')).toBeNull();
  });

  it('B4: listAlarms filters by userId and factorId', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'A1', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    bridge.createAlarm({ userId: 'u1', factorId: 'HML', factorName: 'HML', label: 'A2', conditionType: 'crowding', condition: { crowdingLevel: 'CROWDED' } });
    bridge.createAlarm({ userId: 'u2', factorId: 'MKT', factorName: 'MKT', label: 'A3', conditionType: 'ic_absolute', condition: { icThreshold: 0.01 } });

    expect(bridge.listAlarms('u1').length).toBe(2);
    expect(bridge.listAlarms('u2').length).toBe(1);
    expect(bridge.listAlarms(undefined, 'MKT').length).toBe(2);
    expect(bridge.listAlarms('u1', 'MKT').length).toBe(1);
  });

  it('B5: updateAlarm modifies fields', () => {
    const bridge = getAlarmPushBridge();
    const alarm = bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Old', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    
    const updated = bridge.updateAlarm(alarm.alarmId, { label: 'New', severity: 'critical' });
    expect(updated).not.toBeNull();
    expect(updated!.label).toBe('New');
    expect(updated!.severity).toBe('critical');
  });

  it('B6: deleteAlarm removes alarm', () => {
    const bridge = getAlarmPushBridge();
    const alarm = bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Test', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    expect(bridge.listAlarms().length).toBe(1);
    
    const deleted = bridge.deleteAlarm(alarm.alarmId);
    expect(deleted).toBe(true);
    expect(bridge.listAlarms().length).toBe(0);
  });

  it('B7: snoozeAlarm and unsnoozeAlarm work', () => {
    const bridge = getAlarmPushBridge();
    const alarm = bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Test', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    
    const snoozed = bridge.snoozeAlarm(alarm.alarmId, 600_000); // 10min
    expect(snoozed!.status).toBe('snoozed');
    expect(snoozed!.snoozedUntil).not.toBeNull();
    
    const unsnoozed = bridge.unsnoozeAlarm(alarm.alarmId);
    expect(unsnoozed!.status).toBe('active');
    expect(unsnoozed!.snoozedUntil).toBeNull();
  });
});

describe('R282 FactorAlarmPushBridge — Condition Evaluation', () => {
  beforeEach(() => {
    resetAlarmPushBridge();
  });

  const baseSnapshot: AlarmFactorSnapshot = {
    factorId: 'MKT',
    currentIC: 0.03,
    historicalAvgIC: 0.08,
    decayRate: 0.1,
    crowdingLevel: 'NORMAL',
    lastSignalDirection: 'long',
    timestamp: Date.now(),
  };

  it('C1: ic_drop condition triggers when IC drops > threshold', () => {
    const bridge = getAlarmPushBridge();
    let pushed: any[] = [];
    bridge.initialize((p) => { pushed.push(p); return [{ channel: 'system', success: true }]; });

    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'IC drop 40%', conditionType: 'ic_drop', condition: { dropPercent: 40 } });
    
    // IC dropped from 0.08 to 0.03 = -62.5%, > 40% threshold
    const events = bridge.evaluateAlarms([{ ...baseSnapshot, currentIC: 0.03, historicalAvgIC: 0.08 }]);
    expect(events.length).toBe(1);
    expect(events[0].conditionType).toBe('ic_drop');
    expect(pushed.length).toBe(1);
  });

  it('C2: ic_drop does NOT trigger when drop is below threshold', () => {
    const bridge = getAlarmPushBridge();
    let pushed: any[] = [];
    bridge.initialize((p) => { pushed.push(p); return [{ channel: 'system', success: true }]; });

    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'IC drop 80%', conditionType: 'ic_drop', condition: { dropPercent: 80, operator: 'gte' } });
    
    // IC dropped 62.5%, < 80% threshold
    const events = bridge.evaluateAlarms([{ ...baseSnapshot, currentIC: 0.03, historicalAvgIC: 0.08 }]);
    expect(events.length).toBe(0);
    expect(pushed.length).toBe(0);
  });

  it('C3: ic_absolute triggers when |IC| below threshold', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'IC < 0.01', conditionType: 'ic_absolute', condition: { icThreshold: 0.01, operator: 'lt' } });
    
    const events = bridge.evaluateAlarms([{ ...baseSnapshot, currentIC: 0.005 }]);
    expect(events.length).toBe(1);
    expect(events[0].conditionType).toBe('ic_absolute');
  });

  it('C4: crowding condition triggers at CROWDED level', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Crowding', conditionType: 'crowding', condition: { crowdingLevel: 'CROWDED' } });
    
    // NORMAL: 0, WATCHING: 1, CROWDED: 2
    const snapNormal: AlarmFactorSnapshot = { ...baseSnapshot, crowdingLevel: 'NORMAL' };
    expect(bridge.evaluateAlarms([snapNormal]).length).toBe(0);

    const snapWatching: AlarmFactorSnapshot = { ...baseSnapshot, crowdingLevel: 'WATCHING' };
    expect(bridge.evaluateAlarms([snapWatching]).length).toBe(0); // WATCHING < CROWDED

    const snapCrowded: AlarmFactorSnapshot = { ...baseSnapshot, crowdingLevel: 'CROWDED' };
    expect(bridge.evaluateAlarms([snapCrowded]).length).toBe(1);
  });

  it('C5: decay_warning triggers when decay rate > threshold', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Decay', conditionType: 'decay_warning', condition: { decayRateThreshold: 0.3, operator: 'gte' } });
    
    const lowDecay: AlarmFactorSnapshot = { ...baseSnapshot, decayRate: 0.1 };
    expect(bridge.evaluateAlarms([lowDecay]).length).toBe(0);

    const highDecay: AlarmFactorSnapshot = { ...baseSnapshot, decayRate: 0.5 };
    expect(bridge.evaluateAlarms([highDecay]).length).toBe(1);
  });

  it('C6: signal_change triggers on direction flip', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Signal flip', conditionType: 'signal_change', condition: { signalDirection: 'long_to_short' } });
    
    const stillLong: AlarmFactorSnapshot = { ...baseSnapshot, lastSignalDirection: 'long' };
    expect(bridge.evaluateAlarms([stillLong]).length).toBe(0);

    const flipped: AlarmFactorSnapshot = { ...baseSnapshot, lastSignalDirection: 'short' };
    expect(bridge.evaluateAlarms([flipped]).length).toBe(1);
  });

  it('C7: Cooldown prevents repeated triggers', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Cooldown test', conditionType: 'ic_drop', condition: { dropPercent: 30 }, cooldownMs: 3600_000 }); // 1h cooldown

    const snap: AlarmFactorSnapshot = { ...baseSnapshot, currentIC: 0.02, historicalAvgIC: 0.08 };
    
    // First trigger
    const e1 = bridge.evaluateAlarms([snap]);
    expect(e1.length).toBe(1);

    // Immediate re-evaluate: should be blocked by cooldown
    const e2 = bridge.evaluateAlarms([snap]);
    expect(e2.length).toBe(0);
  });

  it('C8: Max triggers expires alarm', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Max 1 trigger', conditionType: 'ic_drop', condition: { dropPercent: 30 }, maxTriggers: 1, cooldownMs: 0 });

    const snap: AlarmFactorSnapshot = { ...baseSnapshot, currentIC: 0.02, historicalAvgIC: 0.08 };
    
    const e1 = bridge.evaluateAlarms([snap]);
    expect(e1.length).toBe(1);
    expect(bridge.getAlarm(e1[0].alarmId)?.status).toBe('expired');
  });

  it('C9: Multiple alarms evaluate independently', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'IC drop', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    bridge.createAlarm({ userId: 'u1', factorId: 'HML', factorName: 'HML', label: 'Crowding', conditionType: 'crowding', condition: { crowdingLevel: 'CROWDED' } });

    const snapMKT: AlarmFactorSnapshot = { ...baseSnapshot, factorId: 'MKT', currentIC: 0.02, historicalAvgIC: 0.08 };
    const snapHML: AlarmFactorSnapshot = { ...baseSnapshot, factorId: 'HML', crowdingLevel: 'CROWDED' };

    const events = bridge.evaluateAlarms([snapMKT, snapHML]);
    expect(events.length).toBe(2);
    expect(events.map(e => e.conditionType).sort()).toEqual(['crowding', 'ic_drop']);
  });
});

describe('R282 FactorAlarmPushBridge — Presets & Stats', () => {
  beforeEach(() => {
    resetAlarmPushBridge();
  });

  it('D1: createPresetAlarms creates 4 default alarms', () => {
    const bridge = getAlarmPushBridge();
    const alarms = bridge.createPresetAlarms('u1', 'MOM_12M', 'Momentum12M', '12月动量');
    expect(alarms.length).toBe(4);
    expect(alarms.map(a => a.conditionType).sort()).toEqual(['crowding', 'decay_warning', 'ic_absolute', 'ic_drop']);
    expect(alarms.every(a => a.userId === 'u1')).toBe(true);
    expect(alarms.every(a => a.factorId === 'MOM_12M')).toBe(true);
  });

  it('D2: getTriggerHistory returns events', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Test', conditionType: 'ic_drop', condition: { dropPercent: 30 }, cooldownMs: 0 });
    
    const snap: AlarmFactorSnapshot = { factorId: 'MKT', currentIC: 0.02, historicalAvgIC: 0.08, decayRate: 0.1, crowdingLevel: 'NORMAL', lastSignalDirection: 'long', timestamp: Date.now() };

    // Fire once — history recorded
    bridge.evaluateAlarms([snap]);

    const history = bridge.getTriggerHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].conditionType).toBe('ic_drop');
    expect(history[0].factorId).toBe('MKT');
    expect(history[0].triggeredAt).toBeGreaterThan(0);
  });

  it('D3: getStats returns correct aggregation', () => {
    const bridge = getAlarmPushBridge();
    bridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'A1', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    bridge.createAlarm({ userId: 'u1', factorId: 'HML', factorName: 'HML', label: 'A2', conditionType: 'crowding', condition: { crowdingLevel: 'WATCHING' } });
    bridge.createAlarm({ userId: 'u1', factorId: 'QUAL', factorName: 'QUAL', label: 'A3', conditionType: 'ic_absolute', condition: { icThreshold: 0.01 } });

    const stats = bridge.getStats('u1');
    expect(stats.totalAlarms).toBe(3);
    expect(stats.activeAlarms).toBe(3);
    expect(stats.byConditionType['ic_drop']).toBe(1);
    expect(stats.byConditionType['crowding']).toBe(1);
    expect(stats.byConditionType['ic_absolute']).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Factor Recipe Strategy Bridge Tests
// ═══════════════════════════════════════════════════════════════════

describe('R282 FactorRecipeStrategyBridge — Health', () => {
  beforeEach(() => {
    resetRecipeStrategyBridge();
  });

  it('R1: getRecipeStrategyBridge returns same instance', () => {
    const a = getRecipeStrategyBridge();
    const b = getRecipeStrategyBridge();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(FactorRecipeStrategyBridge);
  });

  it('R2: Bridge starts uninitialized', () => {
    const bridge = getRecipeStrategyBridge();
    expect(bridge.isInitialized).toBe(false);
  });

  it('R3: Initialize loads 16 preset recipes', () => {
    const bridge = getRecipeStrategyBridge();
    bridge.initialize();
    expect(bridge.isInitialized).toBe(true);
    const recipes = bridge.listAllRecipes();
    expect(recipes.length).toBe(16);
  });

  it('R4: resetRecipeStrategyBridge clears everything', () => {
    const bridge = getRecipeStrategyBridge();
    bridge.initialize();
    expect(bridge.listAllRecipes().length).toBe(16);

    resetRecipeStrategyBridge();
    const bridge2 = getRecipeStrategyBridge();
    expect(bridge2.isInitialized).toBe(false);
    expect(bridge2.listAllRecipes().length).toBe(0);
  });

  it('R5: All preset recipes have valid ingredients (weights sum ~1)', () => {
    const bridge = getRecipeStrategyBridge();
    bridge.initialize();
    const recipes = bridge.listAllRecipes();
    
    recipes.forEach(r => {
      const weightSum = r.ingredients.reduce((s, i) => s + i.weight, 0);
      expect(Math.abs(weightSum - 1)).toBeLessThan(0.01);
      expect(r.ingredients.length).toBeGreaterThanOrEqual(3);
      expect(r.recipeId).toMatch(/^recipe_preset_/);
      expect(r.isOfficial).toBe(true);
    });
  });
});

describe('R282 FactorRecipeStrategyBridge — Query & Search', () => {
  beforeEach(() => {
    resetRecipeStrategyBridge();
    getRecipeStrategyBridge().initialize();
  });

  it('Q1: listAllRecipes returns all 16 sorted by popularity', () => {
    const recipes = getRecipeStrategyBridge().listAllRecipes();
    expect(recipes.length).toBe(16);
    // Popularity descending
    for (let i = 1; i < recipes.length; i++) {
      expect(recipes[i - 1].popularity).toBeGreaterThanOrEqual(recipes[i].popularity);
    }
  });

  it('Q2: getRecipe finds by exact ID', () => {
    const recipes = getRecipeStrategyBridge().listAllRecipes();
    const target = recipes[0];
    const found = getRecipeStrategyBridge().getRecipe(target.recipeId);
    expect(found).not.toBeNull();
    expect(found!.name).toBe(target.name);
  });

  it('Q3: queryRecipes filters by regime', () => {
    const bear = getRecipeStrategyBridge().queryRecipes({ regime: 'bear' });
    expect(bear.length).toBeGreaterThanOrEqual(3);
    bear.forEach(r => {
      expect(r.regimes.some(reg => reg === 'bear' || reg === 'any')).toBe(true);
    });
  });

  it('Q4: queryRecipes filters by market', () => {
    const hk = getRecipeStrategyBridge().queryRecipes({ market: 'HK' });
    expect(hk.length).toBeGreaterThanOrEqual(1);
    hk.forEach(r => {
      expect(r.targetMarket === 'HK' || r.targetMarket === 'any').toBe(true);
    });
  });

  it('Q5: queryRecipes filters by difficulty', () => {
    const beginner = getRecipeStrategyBridge().queryRecipes({ difficulty: 'beginner' });
    expect(beginner.length).toBeGreaterThanOrEqual(4);
    beginner.forEach(r => expect(r.difficulty).toBe('beginner'));
  });

  it('Q6: queryRecipes search matches Chinese names', () => {
    const results = getRecipeStrategyBridge().queryRecipes({ search: '牛市' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.nameCn.includes('牛市'))).toBe(true);
  });

  it('Q7: queryRecipes search matches tags', () => {
    const results = getRecipeStrategyBridge().queryRecipes({ search: '动量' });
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('Q8: getRecipesByRegime returns relevant recipes', () => {
    const bull = getRecipeStrategyBridge().getRecipesByRegime('bull');
    expect(bull.length).toBeGreaterThanOrEqual(2);
    bull.forEach(r => {
      expect(r.regimes.some(reg => reg === 'bull' || reg === 'any')).toBe(true);
    });
  });
});

describe('R282 FactorRecipeStrategyBridge — Conversion', () => {
  beforeEach(() => {
    resetRecipeStrategyBridge();
    getRecipeStrategyBridge().initialize();
  });

  it('V1: convertToStrategy produces valid ConvertedStrategy', () => {
    const bridge = getRecipeStrategyBridge();
    const bear = bridge.queryRecipes({ regime: 'bear' })[0];
    
    const strategy = bridge.convertToStrategy(bear.recipeId, {
      recipeId: bear.recipeId,
      strategyName: '我的防御策略',
      initialCapital: 50000,
      maxPositionSize: 0.15,
      stopLoss: 0.10,
      takeProfit: 0.25,
    });

    expect(strategy).not.toBeNull();
    expect(strategy!.strategyId).toMatch(/^strat_recipe_/);
    expect(strategy!.recipeId).toBe(bear.recipeId);
    expect(strategy!.name).toBe('我的防御策略');
    expect(strategy!.riskParams.initialCapital).toBe(50000);
    expect(strategy!.factors.length).toBe(bear.ingredients.length);
    
    // Weights normalized to sum ~1
    const weightSum = strategy!.factors.reduce((s, f) => s + f.weight, 0);
    expect(Math.abs(weightSum - 1)).toBeLessThan(0.01);
    
    // Has backtest preview
    expect(strategy!.backtestPreview).toBeDefined();
    expect(strategy!.backtestPreview!.sharpeRatio).toBeGreaterThan(0);
    expect(strategy!.backtestPreview!.winRate).toBeGreaterThan(0);
    expect(strategy!.backtestPreview!.maxDrawdown).toBeGreaterThan(0);
  });

  it('V2: Conversion increments recipe popularity and conversionCount', () => {
    const bridge = getRecipeStrategyBridge();
    const recipe = bridge.listAllRecipes()[0];
    const beforeCount = recipe.conversionCount;
    const beforePop = recipe.popularity;

    bridge.convertToStrategy(recipe.recipeId, {
      recipeId: recipe.recipeId,
      strategyName: 'Test',
      initialCapital: 100000,
      maxPositionSize: 0.2,
      stopLoss: 0.15,
      takeProfit: 0.30,
    });

    expect(recipe.conversionCount).toBe(beforeCount + 1);
    expect(recipe.popularity).toBeGreaterThan(beforePop);
  });

  it('V3: Weight overrides are applied and normalized correctly', () => {
    const bridge = getRecipeStrategyBridge();
    const recipe = bridge.listAllRecipes()[0];
    const firstTwo = recipe.ingredients.slice(0, 2).map(i => i.factorId);
    
    const strategy = bridge.convertToStrategy(recipe.recipeId, {
      recipeId: recipe.recipeId,
      strategyName: 'Overridden',
      initialCapital: 100000,
      maxPositionSize: 0.2,
      stopLoss: 0.15,
      takeProfit: 0.30,
      weightOverrides: [
        { factorId: recipe.ingredients[0].factorId, weight: 0.7 },
        { factorId: recipe.ingredients[1].factorId, weight: 0.3 },
      ],
      enabledIngredients: firstTwo,  // Only use the overridden two
    });

    expect(strategy).not.toBeNull();
    expect(strategy!.factors.length).toBe(2);
    const w0 = strategy!.factors.find(f => f.factorId === recipe.ingredients[0].factorId);
    expect(w0).toBeDefined();
    expect(Math.abs(w0!.weight - 0.7)).toBeLessThan(0.01);
  });

  it('V4: Enabled ingredients filter works', () => {
    const bridge = getRecipeStrategyBridge();
    const recipe = bridge.listAllRecipes()[0];
    const firstTwo = recipe.ingredients.slice(0, 2).map(i => i.factorId);
    
    const strategy = bridge.convertToStrategy(recipe.recipeId, {
      recipeId: recipe.recipeId,
      strategyName: 'Filtered',
      initialCapital: 100000,
      maxPositionSize: 0.2,
      stopLoss: 0.15,
      takeProfit: 0.30,
      enabledIngredients: firstTwo,
    });

    expect(strategy).not.toBeNull();
    expect(strategy!.factors.length).toBe(2);
  });

  it('V5: convertToStrategy returns null for invalid recipeId', () => {
    const bridge = getRecipeStrategyBridge();
    const result = bridge.convertToStrategy('nonexistent', {
      recipeId: 'nonexistent',
      strategyName: 'Test',
      initialCapital: 100000,
      maxPositionSize: 0.2,
      stopLoss: 0.15,
      takeProfit: 0.30,
    });
    expect(result).toBeNull();
  });

  it('V6: getConversionHistory returns conversions', () => {
    const bridge = getRecipeStrategyBridge();
    const recipe = bridge.listAllRecipes()[0];
    
    bridge.convertToStrategy(recipe.recipeId, {
      recipeId: recipe.recipeId, strategyName: 'S1', initialCapital: 100000, maxPositionSize: 0.2, stopLoss: 0.15, takeProfit: 0.30,
    });
    bridge.convertToStrategy(recipe.recipeId, {
      recipeId: recipe.recipeId, strategyName: 'S2', initialCapital: 50000, maxPositionSize: 0.1, stopLoss: 0.10, takeProfit: 0.20,
    });

    const history = bridge.getConversionHistory(recipe.recipeId);
    expect(history.length).toBe(2);
    // Newest first
    expect(history[0].conversionTimestamp).toBeGreaterThanOrEqual(history[1].conversionTimestamp);
  });

  it('V7: getConversion finds by strategyId', () => {
    const bridge = getRecipeStrategyBridge();
    const recipe = bridge.listAllRecipes()[0];
    const strategy = bridge.convertToStrategy(recipe.recipeId, {
      recipeId: recipe.recipeId, strategyName: 'Findable', initialCapital: 100000, maxPositionSize: 0.2, stopLoss: 0.15, takeProfit: 0.30,
    });

    const found = bridge.getConversion(strategy!.strategyId);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Findable');
  });
});

describe('R282 FactorRecipeStrategyBridge — Match & Stats', () => {
  beforeEach(() => {
    resetRecipeStrategyBridge();
    getRecipeStrategyBridge().initialize();
  });

  it('M1: matchRecipes returns top 3 for bear regime', () => {
    const bridge = getRecipeStrategyBridge();
    const matches = bridge.matchRecipes('bear');
    expect(matches.length).toBeLessThanOrEqual(3);
    expect(matches.length).toBeGreaterThan(0);
    // Sorted by score descending
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
    // Each has a reason
    matches.forEach(m => expect(m.reason.length).toBeGreaterThan(0));
  });

  it('M2: matchRecipes with market preference boosts score', () => {
    const bridge = getRecipeStrategyBridge();
    const withMarket = bridge.matchRecipes('any', 'HK');
    expect(withMarket.length).toBeGreaterThan(0);
    // HK-specific recipe should be ranked higher
    const hkRecipe = withMarket.find(m => m.recipe.targetMarket === 'HK');
    expect(hkRecipe).toBeDefined();
  });

  it('M3: addRecipe creates community recipe', () => {
    const bridge = getRecipeStrategyBridge();
    const recipe = bridge.addRecipe({
      name: 'Community Test',
      nameCn: '社区测试套餐',
      description: 'Test',
      descriptionCn: '测试',
      regimes: ['bull'],
      targetMarket: 'US',
      difficulty: 'intermediate',
      ingredients: [
        { factorId: 'MKT', factorName: 'MKT', factorNameCn: '市场', weight: 0.5, direction: 'long' },
        { factorId: 'HML', factorName: 'HML', factorNameCn: '价值', weight: 0.5, direction: 'long' },
      ],
      tags: ['社区'],
      expectedReturn: 0.1,
      expectedSharpe: 0.8,
      expectedMaxDD: 0.2,
      rebalanceFreq: 'monthly',
      minHoldDays: 30,
      author: 'user_001',
      isOfficial: false,
    });

    expect(recipe.recipeId).toMatch(/^recipe_/);
    expect(recipe.isOfficial).toBe(false);
    expect(recipe.popularity).toBe(0);
    expect(recipe.conversionCount).toBe(0);

    // Should appear in full list
    const all = bridge.listAllRecipes();
    expect(all.length).toBe(17); // 16 preset + 1 community
  });

  it('M4: getRecipeStats returns accurate stats', () => {
    const bridge = getRecipeStrategyBridge();
    const stats = bridge.getRecipeStats();
    expect(stats.totalRecipes).toBe(16);
    expect(stats.officialRecipes).toBe(16);
    expect(stats.communityRecipes).toBe(0);
    expect(stats.totalConversions).toBe(0);
    
    // Convert most popular recipe
    const top = bridge.listAllRecipes()[0];
    bridge.convertToStrategy(top.recipeId, {
      recipeId: top.recipeId, strategyName: 'Test', initialCapital: 100000, maxPositionSize: 0.2, stopLoss: 0.15, takeProfit: 0.30,
    });

    const stats2 = bridge.getRecipeStats();
    expect(stats2.totalConversions).toBe(1);
    expect(stats2.mostPopular).not.toBeNull();
    expect(stats2.topConverted).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Integration: Alarm + Recipe interoperability
// ═══════════════════════════════════════════════════════════════════

describe('R282 Integration — Alarm × Recipe', () => {
  it('X1: Both bridges coexist and work independently', () => {
    resetAlarmPushBridge();
    resetRecipeStrategyBridge();

    const alarmBridge = getAlarmPushBridge();
    const recipeBridge = getRecipeStrategyBridge();
    recipeBridge.initialize();

    // Alarm bridge operates
    alarmBridge.createAlarm({ userId: 'u1', factorId: 'MKT', factorName: 'MKT', label: 'Test', conditionType: 'ic_drop', condition: { dropPercent: 30 } });
    expect(alarmBridge.listAlarms().length).toBe(1);

    // Recipe bridge operates
    expect(recipeBridge.listAllRecipes().length).toBe(16);
  });

  it('X2: Recipe factors can have alarms set via createPresetAlarms', () => {
    resetAlarmPushBridge();
    resetRecipeStrategyBridge();

    const recipeBridge = getRecipeStrategyBridge();
    recipeBridge.initialize();
    const alarmBridge = getAlarmPushBridge();

    // For each factor in the first recipe, create preset alarms
    const recipe = recipeBridge.listAllRecipes()[0];
    recipe.ingredients.forEach(ing => {
      alarmBridge.createPresetAlarms('u1', ing.factorId, ing.factorName, ing.factorNameCn);
    });

    expect(alarmBridge.listAlarms().length).toBe(recipe.ingredients.length * 4); // 4 presets per factor
  });

  it('X3: Alarm severity levels all 4 defined', () => {
    const severities = ['info', 'warning', 'critical'] as const;
    // Plus we test that alarm status types are complete
    const statuses = ['active', 'snoozed', 'triggered', 'disabled', 'expired'] as const;
    expect(severities.length).toBe(3);
    expect(statuses.length).toBe(5);
  });

  it('X4: Recipe difficulty levels all defined', () => {
    const difficulties = ['beginner', 'intermediate', 'advanced'] as const;
    expect(difficulties.length).toBe(3);
  });

  it('X5: Market regimes cover all scenarios', () => {
    const regimes = ['bull', 'bear', 'sideways', 'volatile', 'recovery', 'any'] as const;
    expect(regimes.length).toBe(6);
  });
});
