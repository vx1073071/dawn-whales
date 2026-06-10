import React, { useState, useEffect, useCallback, useMemo } from 'react';
// ============================================================
// JVS-R16-P1: Data Quality Monitor Page
// Visualizes data quality scores across 8 dimensions
// ============================================================

// --- Types ---

interface QualityDimension {
  key: string;
  label: string;
  score: number;
  weight: number;
  issueCount: number;
  status: 'pass' | 'warning' | 'fail';
}

interface QualityIssue {
  id: string;
  dimension: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affectedRows: number;
  suggestion: string;
  expanded?: boolean;
}

interface EvaluationRecord {
  id: string;
  symbol: string;
  score: number;
  grade: string;
  timestamp: string;
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  text: string;
  dimension: string;
}

interface DataQualityState {
  overallScore: number;
  grade: string;
  dimensions: QualityDimension[];
  issues: QualityIssue[];
  history: EvaluationRecord[];
  recommendations: Recommendation[];
}

// --- Constants ---

const DIMENSION_CONFIG: { key: string; label: string; weight: number }[] = [
  { key: 'completeness', label: "components.completeness", weight: 15 },
  { key: 'accuracy', label: "components.accuracy", weight: 20 },
  { key: 'timeliness', label: '时效性', weight: 12 },
  { key: 'consistency', label: "components.consistency", weight: 15 },
  { key: 'uniqueness', label: '唯一性', weight: 10 },
  { key: 'validity', label: '有效性', weight: 13 },
  { key: 'uniformity', label: '均匀性', weight: 8 },
  { key: 'coverage', label: '覆盖度', weight: 7 },
];

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-blue-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

const GRADE_BG: Record<string, string> = {
  A: 'from-emerald-500/20 to-emerald-600/5',
  B: 'from-blue-500/20 to-blue-600/5',
  C: 'from-yellow-500/20 to-yellow-600/5',
  D: 'from-orange-500/20 to-orange-600/5',
  F: 'from-red-500/20 to-red-600/5',
};

const GRADE_STROKE: Record<string, string> = {
  A: '#34d399',
  B: '#60a5fa',
  C: '#facc15',
  D: '#fb923c',
  F: '#f87171',
};

// --- Utility Functions ---

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getDimensionStatus(score: number): 'pass' | 'warning' | 'fail' {
  if (score >= 80) return 'pass';
  if (score >= 60) return 'warning';
  return 'fail';
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// --- Quality Scoring Engine ---

function computeDimensionScores(data: any[]): QualityDimension[] {
  if (!data || data.length === 0) {
    return DIMENSION_CONFIG.map((cfg) => ({
      ...cfg,
      score: 0,
      issueCount: 0,
      status: 'fail' as const,
    }));
  }

  const totalRows = data.length;

  return DIMENSION_CONFIG.map((cfg) => {
    let score = 0;
    let issueCount = 0;

    switch (cfg.key) {
      case 'completeness': {
        let filledFields = 0;
        let totalFields = 0;
        data.forEach((row) => {
          const keys = Object.keys(row);
          totalFields += keys.length;
          keys.forEach((k) => {
            if (row[k] !== null && row[k] !== undefined && row[k] !== '') {
              filledFields++;
            }
          });
        });
        score = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
        issueCount = totalFields - filledFields;
        break;
      }
      case 'accuracy': {
        let validCount = 0;
        data.forEach((row) => {
          const hasValidPrice = row.price != null && typeof row.price === 'number' && row.price > 0;
          const hasValidVolume = row.volume == null || (typeof row.volume === 'number' && row.volume >= 0);
          if (hasValidPrice && hasValidVolume) validCount++;
        });
        score = Math.round((validCount / totalRows) * 100);
        issueCount = totalRows - validCount;
        break;
      }
      case 'timeliness': {
        const now = Date.now();
        const oneDay = 86400000;
        let freshCount = 0;
        data.forEach((row) => {
          const ts = row.timestamp || row.date || row.time;
          if (ts) {
            const age = now - new Date(ts).getTime();
            if (age < oneDay * 7) freshCount++;
          }
        });
        score = totalRows > 0 ? Math.round((freshCount / totalRows) * 100) : 50;
        issueCount = totalRows - freshCount;
        break;
      }
      case 'consistency': {
        const formats = new Set<string>();
        data.forEach((row) => {
          if (row.date) formats.add(typeof row.date);
          if (row.price) formats.add(typeof row.price);
        });
        score = formats.size <= 2 ? 95 : Math.max(50, 100 - (formats.size - 2) * 15);
        issueCount = formats.size > 2 ? formats.size - 2 : 0;
        break;
      }
      case 'uniqueness': {
        const seen = new Set<string>();
        let dupes = 0;
        data.forEach((row) => {
          const key = JSON.stringify(row);
          if (seen.has(key)) dupes++;
          seen.add(key);
        });
        score = Math.round(((totalRows - dupes) / totalRows) * 100);
        issueCount = dupes;
        break;
      }
      case 'validity': {
        let validSchema = 0;
        data.forEach((row) => {
          const hasRequired = row.title || row.content || row.source;
          if (hasRequired) validSchema++;
        });
        score = Math.round((validSchema / totalRows) * 100);
        issueCount = totalRows - validSchema;
        break;
      }
      case 'uniformity': {
        const keyCounts = data.map((row) => Object.keys(row).length);
        const avgKeys = keyCounts.reduce((a, b) => a + b, 0) / totalRows;
        const variance = keyCounts.reduce((sum, c) => sum + Math.pow(c - avgKeys, 2), 0) / totalRows;
        score = Math.max(0, Math.round(100 - variance * 5));
        issueCount = keyCounts.filter((c) => Math.abs(c - avgKeys) > 2).length;
        break;
      }
      case 'coverage': {
        const sources = new Set(data.map((r) => r.source).filter(Boolean));
        const categories = new Set(data.map((r) => r.category || r.type).filter(Boolean));
        const sourceScore = Math.min(100, sources.size * 20);
        const catScore = Math.min(100, categories.size * 25);
        score = Math.round((sourceScore + catScore) / 2);
        issueCount = sources.size < 3 ? 3 - sources.size : 0;
        break;
      }
      default:
        score = 75;
        issueCount = 0;
    }

    return {
      ...cfg,
      score: Math.min(100, Math.max(0, score)),
      issueCount,
      status: getDimensionStatus(score),
    };
  });
}

function computeOverallScore(dimensions: QualityDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  return Math.round(weighted / totalWeight);
}

function generateIssues(dimensions: QualityDimension[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  dimensions.forEach((dim) => {
    if (dim.score < 60) {
      issues.push({
        id: generateId(),
        dimension: dim.label,
        severity: 'critical',
        message: `${dim.label}得分低于60，存在严重数据质量问题`,
        affectedRows: dim.issueCount,
        suggestion: getCriticalSuggestion(dim.key),
      });
    } else if (dim.score < 80) {
      issues.push({
        id: generateId(),
        dimension: dim.label,
        severity: 'warning',
        message: `${dim.label}得分偏低，建议关注`,
        affectedRows: dim.issueCount,
        suggestion: getWarningSuggestion(dim.key),
      });
    } else if (dim.issueCount > 0) {
      issues.push({
        id: generateId(),
        dimension: dim.label,
        severity: 'info',
        message: `${dim.label}存在 ${dim.issueCount} 个小问题`,
        affectedRows: dim.issueCount,
        suggestion: '建议持续监控，确保数据质量不下降',
      });
    }
  });

  return issues.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

function getCriticalSuggestion(key: string): string {
  const map: Record<string, string> = {
    completeness: '建议检查数据源连接，确保所有必填字段都有值。考虑增加默认值填充策略。',
    accuracy: '建议增加数据验证规则，过滤异常值。检查价格字段是否存在负值或零值。',
    timeliness: '建议检查数据管道延迟，设置数据新鲜度告警阈值。',
    consistency: '建议统一数据格式标准，增加格式转换中间层。',
    uniqueness: '建议增加去重逻辑，检查数据源是否存在重复推送。',
    validity: '建议增加 Schema 校验，拒绝不符合规范的数据入库。',
    uniformity: '建议统一字段命名规范，增加数据清洗步骤。',
    coverage: '建议增加更多数据源接入，扩大信息采集范围。',
  };
  return map[key] || '建议深入排查问题根因。';
}

function getWarningSuggestion(key: string): string {
  const map: Record<string, string> = {
    completeness: '建议对缺失字段增加默认值或标记为待补充。',
    accuracy: '建议对异常值增加平滑处理逻辑。',
    timeliness: '建议优化数据刷新频率，缩短延迟窗口。',
    consistency: '建议逐步统一历史数据格式。',
    uniqueness: '建议定期执行去重扫描任务。',
    validity: '建议增加字段类型校验规则。',
    uniformity: '建议规范化字段命名，统一大小写。',
    coverage: '建议逐步接入更多数据源提升覆盖率。',
  };
  return map[key] || '建议持续关注该指标变化趋势。';
}

function generateRecommendations(issues: QualityIssue[], dimensions: QualityDimension[]): Recommendation[] {
  const recs: Recommendation[] = [];

  const criticalDims = dimensions.filter((d) => d.score < 60);
  const warningDims = dimensions.filter((d) => d.score >= 60 && d.score < 80);

  criticalDims.forEach((dim) => {
    recs.push({
      id: generateId(),
      priority: 'high',
      text: `紧急：${dim.label}维度得分仅 ${dim.score} 分，需要立即介入处理`,
      dimension: dim.label,
    });
  });

  warningDims.forEach((dim) => {
    recs.push({
      id: generateId(),
      priority: 'medium',
      text: `关注：${dim.label}维度有提升空间，当前 ${dim.score} 分`,
      dimension: dim.label,
    });
  });

  if (issues.filter((i) => i.severity === 'critical').length > 3) {
    recs.push({
      id: generateId(),
      priority: 'high',
      text: '严重问题超过3个，建议启动全面数据治理流程',
      dimension: '全局',
    });
  }

  if (dimensions.every((d) => d.score >= 80)) {
    recs.push({
      id: generateId(),
      priority: 'low',
      text: '整体数据质量良好，建议保持当前数据治理标准',
      dimension: '全局',
    });
  }

  return recs;
}

// --- SVG Gauge Component ---

const ScoreGauge: React.FC<{ score: number; grade: string }> = ({ score, grade }) => {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const strokeColor = GRADE_STROKE[grade] || '#60a5fa';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="240" height="240" viewBox="0 0 240 240" className="transform -rotate-90">
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="16"
        />
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${strokeColor}40)` }}
        />
        <circle
          cx="120"
          cy="120"
          r={radius - 20}
          fill="none"
          stroke="rgba(255,255,255,0.02)"
          strokeWidth="1"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold ${GRADE_COLORS[grade] || 'text-white'}`}>
          {score}
        </span>
        <span className={`text-2xl font-semibold mt-1 ${GRADE_COLORS[grade] || 'text-white'}`}>
          {grade}
        </span>
        <span className="text-xs text-gray-400 mt-2">{'综合评分'}</span>
      </div>
    </div>
  );
};

// --- Dimension Card ---

const DimensionCard: React.FC<{ dimension: QualityDimension }> = ({ dimension }) => {
  const statusColors = {
    pass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    fail: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const statusLabels = { pass: '正常', warning: 'components.warning', fail: '异常' };
  const barColor =
    dimension.score >= 80
      ? 'bg-emerald-500'
      : dimension.score >= 60
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-200">{dimension.label}</h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColors[dimension.status]}`}
        >
          {statusLabels[dimension.status]}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-white">{dimension.score}</span>
        <span className="text-xs text-gray-500 mb-1">/100</span>
      </div>

      {/* Score Bar */}
      <div className="w-full bg-white/5 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className={`h-2 rounded-full ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${dimension.score}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>权重 {dimension.weight}%</span>
        <span>{dimension.issueCount} 个问题</span>
      </div>
    </div>
  );
};

// --- Issue Row ---

const IssueRow: React.FC<{
  issue: QualityIssue;
  onToggle: () => void;
  expanded: boolean;
}> = ({ issue, onToggle, expanded }) => {
  const severityColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  const severityLabels = { critical: '严重', warning: 'components.warning', info: '提示' };

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="text-gray-500 text-xs">{expanded ? '▼' : '▶'}</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${severityColors[issue.severity]}`}
        >
          {severityLabels[issue.severity]}
        </span>
        <span className="text-sm text-gray-200 flex-1 truncate">{issue.message}</span>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {issue.affectedRows} 行
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pl-12">
          <div className="bg-white/5 rounded-lg p-3 text-sm">
            <p className="text-gray-400 mb-2">
              <span className="text-gray-500">{'维度：'}</span>
              {issue.dimension}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-500">{'建议：'}</span>
              {issue.suggestion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// --- History Table ---

const HistoryTable: React.FC<{ history: EvaluationRecord[] }> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">{'暂无评估记录'}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-white/10">
            <th className="pb-2 font-medium">{'标的'}</th>
            <th className="pb-2 font-medium">{'评分'}</th>
            <th className="pb-2 font-medium">{'等级'}</th>
            <th className="pb-2 font-medium text-right">{"components.time"}</th>
          </tr>
        </thead>
        <tbody>
          {history.map((rec) => (
            <tr key={rec.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-2.5 text-gray-200">{rec.symbol}</td>
              <td className="py-2.5 text-white font-medium">{rec.score}</td>
              <td className="py-2.5">
                <span className={`${GRADE_COLORS[rec.grade]} font-medium`}>{rec.grade}</span>
              </td>
              <td className="py-2.5 text-gray-400 text-right text-xs">{rec.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Recommendation Item ---

const RecommendationItem: React.FC<{ rec: Recommendation }> = ({ rec }) => {
  const priorityColors = {
    high: 'border-l-red-500 bg-red-500/5',
    medium: 'border-l-yellow-500 bg-yellow-500/5',
    low: 'border-l-emerald-500 bg-emerald-500/5',
  };
  const priorityLabels = { high: '高', medium: '中', low: '低' };
  const priorityBadge = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-emerald-500/20 text-emerald-400',
  };

  return (
    <div
      className={`border-l-2 ${priorityColors[rec.priority]} rounded-r-lg px-4 py-3 mb-2 transition-all hover:translate-x-1`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${priorityBadge[rec.priority]}`}
        >
          {priorityLabels[rec.priority]}
        </span>
        <span className="text-xs text-gray-500">{rec.dimension}</span>
      </div>
      <p className="text-sm text-gray-300">{rec.text}</p>
    </div>
  );
};

// --- Main Component ---

const DataQualityPage: React.FC = () => {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [qualityState, setQualityState] = useState<DataQualityState>({
    overallScore: 0,
    grade: 'F',
    dimensions: [],
    issues: [],
    history: [],
    recommendations: [],
  });
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  // Load symbols from watchlist
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const watchlist = await window.api?.db?.getWatchlist?.();
        if (watchlist && Array.isArray(watchlist) && watchlist.length > 0) {
          const syms = watchlist.map((w: Record<string, unknown>) => w.symbol || w).filter(Boolean);
          setSymbols(syms as any);
          if (syms.length > 0 && !selectedSymbol) {
            setSelectedSymbol(syms[0] as any);
          }
        } else {
          const defaults = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
          setSymbols(defaults);
          setSelectedSymbol(defaults[0]);
        }
      } catch {
        const defaults = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
        setSymbols(defaults);
        setSelectedSymbol(defaults[0]);
      }
    };
    loadSymbols();
  }, []);

  // Run quality evaluation
  const runEvaluation = useCallback(
    async (symbol: string) => {
      if (!symbol) return;
      setLoading(true);

      try {
        // Fetch sample data via IPC
        let rawData: any[] = [];
        try {
          const newsData = await window.api?.dataProvider?.getNews?.(symbol, 10);
          if (newsData && Array.isArray(newsData)) {
            rawData = newsData;
          }
        } catch {
          // Fallback: generate synthetic data for demo
          rawData = Array.from({ length: 10 }, (_, i) => ({
            title: `${symbol} News Item ${i + 1}`,
            content: i % 3 === 0 ? null : `Content for ${symbol} article ${i + 1}`,
            source: ['Reuters', 'Bloomberg', 'CNBC'][i % 3],
            date: new Date(Date.now() - i * 86400000).toISOString(),
            price: i % 7 === 0 ? null : 100 + Math.random() * 50,
            volume: i % 5 === 0 ? -1 : Math.floor(Math.random() * 1000000),
            category: ['earnings', 'market', 'analysis'][i % 3],
          }));
        }

        // If still empty, create minimal data
        if (rawData.length === 0) {
          rawData = [{ title: `${symbol} Data`, source: 'API', date: new Date().toISOString() }];
        }

        // Compute quality metrics
        const dimensions = computeDimensionScores(rawData);
        const overallScore = computeOverallScore(dimensions);
        const grade = getGrade(overallScore);
        const issues = generateIssues(dimensions);
        const recommendations = generateRecommendations(issues, dimensions);

        // Build history record
        const newRecord: EvaluationRecord = {
          id: generateId(),
          symbol,
          score: overallScore,
          grade,
          timestamp: new Date().toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };

        setQualityState((prev) => ({
          overallScore,
          grade,
          dimensions,
          issues,
          history: [newRecord, ...prev.history].slice(0, 20),
          recommendations,
        }));

        setLastRefresh(
          new Date().toLocaleString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch (err) {
        console.error('Quality evaluation failed:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Auto-evaluate on symbol change
  useEffect(() => {
    if (selectedSymbol) {
      runEvaluation(selectedSymbol);
    }
  }, [selectedSymbol, runEvaluation]);

  // Toggle issue expansion
  const toggleIssue = useCallback((id: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Summary stats
  const stats = useMemo(() => {
    const { issues, dimensions } = qualityState;
    return {
      criticalCount: issues.filter((i) => i.severity === 'critical').length,
      warningCount: issues.filter((i) => i.severity === 'warning').length,
      infoCount: issues.filter((i) => i.severity === 'info').length,
      avgDimensionScore:
        dimensions.length > 0
          ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
          : 0,
      totalIssues: issues.length,
    };
  }, [qualityState]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              数据质量监控
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              JVS-90 数据质量评估引擎 · 8维度深度分析
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Symbol Selector */}
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                         appearance-none cursor-pointer hover:bg-white/8 transition-all"
            >
              {symbols.map((s) => (
                <option key={s} value={s} className="bg-gray-800 text-white">
                  {s}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => runEvaluation(selectedSymbol)}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30
                         text-blue-400 px-4 py-2 rounded-lg text-sm font-medium transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {loading ? '评估中...' : '重新评估'}
            </button>
          </div>
        </div>

        {lastRefresh && (
          <p className="text-xs text-gray-500 mb-6 -mt-4">
            上次更新: {lastRefresh}
          </p>
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Gauge + Summary */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Overall Score Gauge */}
            <div
              className={`bg-gradient-to-br ${GRADE_BG[qualityState.grade] || 'from-blue-500/20 to-blue-600/5'}
                         backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center`}
            >
              <h2 className="text-sm font-medium text-gray-400 mb-4">{'综合质量评分'}</h2>
              <ScoreGauge score={qualityState.overallScore} grade={qualityState.grade} />
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                <span>
                  标的：<span className="text-white font-medium">{selectedSymbol || '-'}</span>
                </span>
                <span>|</span>
                <span>
                  维度均分：
                  <span className="text-white font-medium">{stats.avgDimensionScore}</span>
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.criticalCount}</div>
                <div className="text-[10px] text-gray-500 mt-1">{'严重问题'}</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{stats.warningCount}</div>
                <div className="text-[10px] text-gray-500 mt-1">{"components.warning"}</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.infoCount}</div>
                <div className="text-[10px] text-gray-500 mt-1">{'提示'}</div>
              </div>
            </div>

            {/* Evaluation History */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <h2 className="text-sm font-medium text-gray-400 mb-4">{'评估历史'}</h2>
              <HistoryTable history={qualityState.history} />
            </div>
          </div>

          {/* Right Column: Dimensions + Issues + Recommendations */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* 8 Dimension Cards */}
            <div>
              <h2 className="text-sm font-medium text-gray-400 mb-3">{'8维度评分'}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {qualityState.dimensions.map((dim) => (
                  <DimensionCard key={dim.key} dimension={dim} />
                ))}
              </div>
            </div>

            {/* Issues List */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-400">
                  质量问题列表
                  <span className="ml-2 text-xs text-gray-600">
                    ({qualityState.issues.length} 项)
                  </span>
                </h2>
                {qualityState.issues.length > 0 && (
                  <button
                    onClick={() => {
                      const allIds = qualityState.issues.map((i) => i.id);
                      const allExpanded = allIds.every((id) => expandedIssues.has(id));
                      if (allExpanded) {
                        setExpandedIssues(new Set());
                      } else {
                        setExpandedIssues(new Set(allIds));
                      }
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {qualityState.issues.every((i) => expandedIssues.has(i.id))
                      ? '全部收起'
                      : '全部展开'}
                  </button>
                )}
              </div>
              {qualityState.issues.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  {loading ? '正在评估数据质量...' : '暂无质量问题，数据质量优秀 🎉'}
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {qualityState.issues.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      expanded={expandedIssues.has(issue.id)}
                      onToggle={() => toggleIssue(issue.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations Panel */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-400">
                  改进建议
                  <span className="ml-2 text-xs text-gray-600">
                    ({qualityState.recommendations.length} 条)
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" title="高优先级" />
                  <span className="w-2 h-2 rounded-full bg-yellow-500" title="中优先级" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="低优先级" />
                </div>
              </div>
              {qualityState.recommendations.length === 0 ? (
                <div className="text-center text-gray-500 py-6 text-sm">
                  {loading ? '正在生成建议...' : '运行评估后将显示改进建议'}
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-1">
                  {qualityState.recommendations.map((rec) => (
                    <RecommendationItem key={rec.id} rec={rec} />
                  ))}
                </div>
              )}
            </div>

            {/* Weight Distribution Visual */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <h2 className="text-sm font-medium text-gray-400 mb-4">{'维度权重分布'}</h2>
              <div className="space-y-2">
                {DIMENSION_CONFIG.map((cfg) => {
                  const dim = qualityState.dimensions.find((d) => d.key === cfg.key);
                  const barWidth = (cfg.weight / 20) * 100;
                  return (
                    <div key={cfg.key} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
                        {cfg.label}
                      </span>
                      <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden relative">
                        <div
                          className="h-3 rounded-full transition-all duration-700"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: dim
                              ? dim.score >= 80
                                ? '#34d399'
                                : dim.score >= 60
                                  ? '#facc15'
                                  : '#f87171'
                              : '#4b5563',
                            opacity: 0.7,
                          }}
                        />
                        <span
                          className="absolute inset-0 flex items-center pl-2 text-[10px] text-white/80 font-medium"
                        >
                          {cfg.weight}%
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 w-8">
                        {dim ? dim.score : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-600">
          <span>{'JVS-R16-P1 · 数据质量监控引擎'}</span>
          <span>{'8维度加权评估 · 实时分析'}</span>
        </div>
      </div>
    </div>
  );
};

export default DataQualityPage;
