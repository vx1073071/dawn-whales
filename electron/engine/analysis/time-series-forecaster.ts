
/**
 * JVS-96: Time Series Forecaster
 *
 * Predicts future prices using statistical models:
 * - EMA (Exponential Moving Average) smoothing
 * - Linear Regression (OLS)
 * - Simple AR(1) autoregressive model
 * - Ensemble (weighted average of all models)
 *
 * All math is implemented manually — no external dependencies.
 */

import log from 'electron-log';

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────

export interface ForecastPoint {
  /** Timestamp (unix ms or sequential index) for this predicted point */
  time: number;
  /** Predicted value */
  value: number;
  /** Lower bound of the confidence interval */
  lower: number;
  /** Upper bound of the confidence interval */
  upper: number;
}

export interface ForecastResult {
  /** Array of predicted data points with confidence intervals */
  predictions: ForecastPoint[];
  /** Name of the model used */
  model: string;
  /** Accuracy metrics computed via backtesting */
  accuracy: {
    /** Mean Absolute Error */
    mae: number;
    /** Root Mean Squared Error */
    rmse: number;
    /** Mean Absolute Percentage Error (0-1 scale) */
    mape: number;
    /** R-squared (coefficient of determination) */
    r2: number;
  };
  /** Number of samples used for training */
  trainingSamples: number;
  /** Wall-clock duration of the forecast in milliseconds */
  durationMs: number;
}

export interface ModelConfig {
  /** Which forecasting model to use */
  type: 'ema' | 'linear_regression' | 'arima_simple' | 'ensemble';
  /** How many future steps to predict */
  horizon: number;
  /** Confidence level for prediction intervals (0-1, e.g. 0.95) */
  confidenceLevel: number;
}

export interface TrendResult {
  /** Overall direction of the series */
  direction: 'up' | 'down' | 'flat';
  /** Strength of the trend (0 = no trend, 1 = very strong) */
  strength: number;
  /** Indices where the trend direction changes significantly */
  changePoints: number[];
}

export interface SeasonalityResult {
  /** Detected period length (number of data points per cycle) */
  period: number;
  /** Amplitude of the seasonal component */
  amplitude: number;
  /** Confidence in the detected seasonality (0-1) */
  confidence: number;
}

export interface DecompositionResult {
  /** Trend component */
  trend: number[];
  /** Seasonal component */
  seasonal: number[];
  /** Residual (remainder) component */
  residual: number[];
}

export interface AccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
}

// ─────────────────────────────────────────────
// Helper: Statistical Utilities
// ─────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return sumSq / (arr.length - 1);
}

function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function covariance(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (x[i] - mx) * (y[i] - my);
  }
  return sum / (n - 1);
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const sx = stddev(x);
  const sy = stddev(y);
  if (sx === 0 || sy === 0) return 0;
  return covariance(x, y) / (sx * sy);
}

/**
 * Compute the z-score for a given confidence level (two-tailed).
 * Uses a rational approximation of the inverse normal CDF.
 */
function zScoreForConfidence(confidenceLevel: number): number {
  // Clamp to valid range
  const cl = Math.max(0.5, Math.min(0.999, confidenceLevel));
  // Probability in one tail
  const p = (1 - cl) / 2;
  // Abramowitz & Stegun approximation for inverse normal
  // For 0 < p <= 0.5
  const a0 = 2.515517;
  const a1 = 0.802853;
  const a2 = 0.010328;
  const b1 = 1.432788;
  const b2 = 0.189269;
  const b3 = 0.001308;

  const t = Math.sqrt(-2 * Math.log(p));
  const z = t - (a0 + a1 * t + a2 * t * t) / (1 + b1 * t + b2 * t * t + b3 * t * t * t);
  return z;
}

/**
 * Compute autocorrelation at a specific lag.
 */
function autocorrelation(data: number[], lag: number): number {
  const n = data.length;
  if (lag >= n) return 0;
  const m = mean(data);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    denominator += (data[i] - m) * (data[i] - m);
  }
  if (denominator === 0) return 0;
  for (let i = 0; i < n - lag; i++) {
    numerator += (data[i] - m) * (data[i + lag] - m);
  }
  return numerator / denominator;
}

// ─────────────────────────────────────────────
// Class: TimeSeriesForecaster
// ─────────────────────────────────────────────

export class TimeSeriesForecaster {
  private readonly MIN_DATA_POINTS = 5;
  private readonly EMA_ALPHA = 0.3;
  private readonly SEASONALITY_MAX_PERIOD_RATIO = 0.5;
  private readonly CHANGE_POINT_WINDOW = 3;

  constructor() {
    log.info('[TimeSeriesForecaster] Initialized');
  }

  // ─── Main Forecast Method ─────────────────

  /**
   * Generate a forecast for the given data using the specified model config.
   */
  forecast(data: number[], config: ModelConfig): ForecastResult {
    const startTime = performance.now();

    if (data.length < this.MIN_DATA_POINTS) {
      log.warn(
        `[TimeSeriesForecaster] Insufficient data: ${data.length} points (min ${this.MIN_DATA_POINTS})`
      );
      return this.emptyResult(config, data.length, 0);
    }

    log.info(
      `[TimeSeriesForecaster] Forecasting with model=${config.type}, ` +
        `horizon=${config.horizon}, dataLength=${data.length}`
    );

    let predictions: ForecastPoint[];
    let modelName: string;

    switch (config.type) {
      case 'ema':
        predictions = this.forecastEMA(data, config);
        modelName = 'Exponential Moving Average';
        break;
      case 'linear_regression':
        predictions = this.forecastLinearRegression(data, config);
        modelName = 'Linear Regression (OLS)';
        break;
      case 'arima_simple':
        predictions = this.forecastAR1(data, config);
        modelName = 'AR(1) Autoregressive';
        break;
      case 'ensemble':
        predictions = this.forecastEnsemble(data, config);
        modelName = 'Ensemble (EMA + OLS + AR1)';
        break;
      default:
        log.error(`[TimeSeriesForecaster] Unknown model type: ${config.type}`);
        predictions = this.forecastEMA(data, config);
        modelName = 'Fallback EMA';
    }

    // Compute accuracy via backtesting
    const accuracy = this.evaluate(data, config);

    const durationMs = performance.now() - startTime;

    log.info(
      `[TimeSeriesForecaster] Forecast complete: ${predictions.length} points, ` +
        `MAE=${accuracy.mae.toFixed(4)}, R²=${accuracy.r2.toFixed(4)}, ${durationMs.toFixed(1)}ms`
    );

    return {
      predictions,
      model: modelName,
      accuracy,
      trainingSamples: data.length,
      durationMs,
    };
  }

  // ─── EMA Forecast ─────────────────────────

  /**
   * Exponential Moving Average forecast.
   * Uses single-parameter exponential smoothing to project forward.
   */
  private forecastEMA(data: number[], config: ModelConfig): ForecastPoint[] {
    const alpha = this.EMA_ALPHA;
    const n = data.length;

    // Compute EMA series
    const emaSeries: number[] = new Array(n);
    emaSeries[0] = data[0];
    for (let i = 1; i < n; i++) {
      emaSeries[i] = alpha * data[i] + (1 - alpha) * emaSeries[i - 1];
    }

    // Compute residuals for confidence intervals
    const residuals: number[] = [];
    for (let i = 1; i < n; i++) {
      residuals.push(data[i] - emaSeries[i - 1]);
    }

    const lastValue = emaSeries[n - 1];
    // Trend estimate from last few EMA values
    const trendWindow = Math.min(5, n - 1);
    let trendSlope = 0;
    if (trendWindow >= 2) {
      const recentEma = emaSeries.slice(n - trendWindow);
      const indices = recentEma.map((_, i) => i);
      const slopeResult = this.olsSlope(indices, recentEma);
      trendSlope = slopeResult;
    }

    return this.buildPredictions(
      lastValue,
      trendSlope,
      config.horizon,
      residuals,
      config.confidenceLevel,
      n
    );
  }

  // ─── Linear Regression Forecast ───────────

  /**
   * Ordinary Least Squares linear regression forecast.
   * Fits y = mx + b to the entire series and extrapolates.
   */
  private forecastLinearRegression(data: number[], config: ModelConfig): ForecastPoint[] {
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data;

    const mx = mean(x);
    const my = mean(y);

    let ssxy = 0;
    let ssxx = 0;
    for (let i = 0; i < n; i++) {
      ssxy += (x[i] - mx) * (y[i] - my);
      ssxx += (x[i] - mx) * (x[i] - mx);
    }

    const slope = ssxx === 0 ? 0 : ssxy / ssxx;
    const intercept = my - slope * mx;

    // Fitted values and residuals
    const fitted: number[] = [];
    const residuals: number[] = [];
    for (let i = 0; i < n; i++) {
      const fv = slope * i + intercept;
      fitted.push(fv);
      residuals.push(y[i] - fv);
    }

    // Last fitted value
    const lastValue = slope * (n - 1) + intercept;

    return this.buildPredictions(
      lastValue,
      slope,
      config.horizon,
      residuals,
      config.confidenceLevel,
      n
    );
  }

  // ─── AR(1) Forecast ───────────────────────

  /**
   * Simple AR(1) autoregressive model.
   * Models x(t) = phi * x(t-1) + c + epsilon
   * where phi is estimated via OLS on lagged values.
   */
  private forecastAR1(data: number[], config: ModelConfig): ForecastPoint[] {
    const n = data.length;

    // Demean the series
    const m = mean(data);
    const demeaned = data.map((v) => v - m);

    // Estimate phi via OLS: x(t) = phi * x(t-1)
    const xLag = demeaned.slice(0, n - 1);
    const xCurr = demeaned.slice(1, n);

    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < xLag.length; i++) {
      sumXY += xLag[i] * xCurr[i];
      sumXX += xLag[i] * xLag[i];
    }

    // Clamp phi to [-0.999, 0.999] for stationarity
    let phi = sumXX === 0 ? 0 : sumXY / sumXX;
    phi = Math.max(-0.999, Math.min(0.999, phi));

    // Compute residuals
    const residuals: number[] = [];
    for (let i = 1; i < n; i++) {
      const predicted = phi * demeaned[i - 1];
      residuals.push(demeaned[i] - predicted);
    }

    // Forecast forward
    const lastDemeaned = demeaned[n - 1];
    const predictions: ForecastPoint[] = [];
    let currentDemeaned = lastDemeaned;
    const z = zScoreForConfidence(config.confidenceLevel);
    const residualStd = stddev(residuals.length > 0 ? residuals : [0]);

    for (let h = 1; h <= config.horizon; h++) {
      currentDemeaned = phi * currentDemeaned;
      const value = currentDemeaned + m;

      // Confidence interval widens with horizon
      // Var(h-step) = sigma^2 * (1 + phi^2 + phi^4 + ... + phi^(2(h-1)))
      let varSum = 0;
      let phiPower = 1;
      for (let j = 0; j < h; j++) {
        varSum += phiPower;
        phiPower *= phi * phi;
      }
      const se = residualStd * Math.sqrt(varSum);

      predictions.push({
        time: n - 1 + h,
        value,
        lower: value - z * se,
        upper: value + z * se,
      });
    }

    return predictions;
  }

  // ─── Ensemble Forecast ────────────────────

  /**
   * Ensemble model: averages predictions from EMA, Linear Regression, and AR(1).
   * Confidence intervals are based on the spread of individual model predictions.
   */
  private forecastEnsemble(data: number[], config: ModelConfig): ForecastPoint[] {
    const emaPred = this.forecastEMA(data, config);
    const lrPred = this.forecastLinearRegression(data, config);
    const ar1Pred = this.forecastAR1(data, config);

    const n = config.horizon;
    const predictions: ForecastPoint[] = [];

    // Compute ensemble residuals from all three models
    const emaAcc = this.computeInSampleAccuracy(data, 'ema');
    const lrAcc = this.computeInSampleAccuracy(data, 'linear_regression');
    const ar1Acc = this.computeInSampleAccuracy(data, 'arima_simple');

    // Weights inversely proportional to MAE (better model = higher weight)
    const totalInvMae =
      1 / (emaAcc.mae + 1e-10) + 1 / (lrAcc.mae + 1e-10) + 1 / (ar1Acc.mae + 1e-10);
    const wEma = (1 / (emaAcc.mae + 1e-10)) / totalInvMae;
    const wLr = (1 / (lrAcc.mae + 1e-10)) / totalInvMae;
    const wAr1 = (1 / (ar1Acc.mae + 1e-10)) / totalInvMae;

    log.debug(
      `[TimeSeriesForecaster] Ensemble weights: EMA=${wEma.toFixed(3)}, ` +
        `LR=${wLr.toFixed(3)}, AR1=${wAr1.toFixed(3)}`
    );

    for (let i = 0; i < n; i++) {
      const vEma = emaPred[i].value;
      const vLr = lrPred[i].value;
      const vAr1 = ar1Pred[i].value;

      const value = wEma * vEma + wLr * vLr + wAr1 * vAr1;

      // Confidence interval from model disagreement + average residual std
      const values = [vEma, vLr, vAr1];
      const modelMean = mean(values);
      const modelSpread = stddev(values);

      // Also factor in the average in-sample residual
      const avgResidualStd =
        (emaAcc.residualStd + lrAcc.residualStd + ar1Acc.residualStd) / 3;

      // Combined uncertainty: model spread + residual uncertainty, scaled by sqrt(horizon)
      const horizonFactor = Math.sqrt(i + 1);
      const z = zScoreForConfidence(config.confidenceLevel);
      const uncertainty = z * Math.sqrt(modelSpread * modelSpread + avgResidualStd * avgResidualStd) * horizonFactor;

      predictions.push({
        time: data.length - 1 + i + 1,
        value,
        lower: value - uncertainty,
        upper: value + uncertainty,
      });
    }

    return predictions;
  }

  // ─── Evaluate (Backtesting) ───────────────

  /**
   * Evaluate model accuracy using rolling-origin backtesting.
   * Splits the data into train/test windows and measures prediction error.
   */
  evaluate(data: number[], config: ModelConfig): AccuracyMetrics {
    if (data.length < this.MIN_DATA_POINTS + 2) {
      return { mae: 0, rmse: 0, mape: 0, r2: 0 };
    }

    const n = data.length;
    // Use last 20% of data as test set (or at least 3 points)
    const testSize = Math.max(3, Math.floor(n * 0.2));
    const trainSize = n - testSize;

    if (trainSize < this.MIN_DATA_POINTS) {
      return { mae: 0, rmse: 0, mape: 0, r2: 0 };
    }

    const trainData = data.slice(0, trainSize);
    const testData = data.slice(trainSize);

    // Generate predictions for the test horizon
    const testConfig: ModelConfig = {
      type: config.type,
      horizon: testSize,
      confidenceLevel: config.confidenceLevel,
    };

    let predictions: ForecastPoint[];
    switch (config.type) {
      case 'ema':
        predictions = this.forecastEMA(trainData, testConfig);
        break;
      case 'linear_regression':
        predictions = this.forecastLinearRegression(trainData, testConfig);
        break;
      case 'arima_simple':
        predictions = this.forecastAR1(trainData, testConfig);
        break;
      case 'ensemble':
        predictions = this.forecastEnsemble(trainData, testConfig);
        break;
      default:
        predictions = this.forecastEMA(trainData, testConfig);
    }

    // Compute metrics
    const actuals = testData;
    const predicted = predictions.map((p) => p.value);

    return this.computeMetrics(actuals, predicted);
  }

  // ─── Trend Detection ──────────────────────

  /**
   * Detect the overall trend direction, strength, and change points.
   */
  detectTrend(data: number[]): TrendResult {
    if (data.length < 3) {
      return { direction: 'flat', strength: 0, changePoints: [] };
    }

    const n = data.length;

    // Overall trend via linear regression slope
    const x = data.map((_, i) => i);
    const slope = this.olsSlope(x, data);
    const yStd = stddev(data);

    // Normalize slope relative to data variability
    const normalizedSlope = yStd === 0 ? 0 : slope / yStd;

    // Determine direction
    let direction: 'up' | 'down' | 'flat';
    if (normalizedSlope > 0.05) {
      direction = 'up';
    } else if (normalizedSlope < -0.05) {
      direction = 'down';
    } else {
      direction = 'flat';
    }

    // Strength: R² of the linear fit
    const intercept = mean(data) - slope * mean(x);
    const fitted = data.map((_, i) => slope * i + intercept);
    const r2 = this.computeR2(data, fitted);
    const strength = Math.min(1, Math.abs(r2));

    // Change point detection using CUSUM-like approach
    const changePoints = this.detectChangePoints(data);

    log.debug(
      `[TimeSeriesForecaster] Trend: ${direction}, strength=${strength.toFixed(3)}, ` +
        `changePoints=${changePoints.length}`
    );

    return { direction, strength, changePoints };
  }

  // ─── Seasonality Detection ────────────────

  /**
   * Detect periodic patterns in the data using autocorrelation.
   */
  detectSeasonality(data: number[]): SeasonalityResult {
    const n = data.length;
    const maxPeriod = Math.floor(n * this.SEASONALITY_MAX_PERIOD_RATIO);

    if (n < 6 || maxPeriod < 2) {
      return { period: 0, amplitude: 0, confidence: 0 };
    }

    // Remove trend first (detrend via linear regression)
    const x = data.map((_, i) => i);
    const slope = this.olsSlope(x, data);
    const intercept = mean(data) - slope * mean(x);
    const detrended = data.map((v, i) => v - (slope * i + intercept));

    // Compute autocorrelation for lags 2..maxPeriod
    let bestLag = 0;
    let bestAcf = -1;

    for (let lag = 2; lag <= maxPeriod; lag++) {
      const acf = autocorrelation(detrended, lag);
      if (acf > bestAcf) {
        bestAcf = acf;
        bestLag = lag;
      }
    }

    // Significance threshold: approximately 2/sqrt(n)
    const significanceThreshold = 2 / Math.sqrt(n);
    const confidence = Math.max(0, Math.min(1, (bestAcf - significanceThreshold) / (1 - significanceThreshold)));

    // Estimate amplitude from the detrended data folded at the detected period
    let amplitude = 0;
    if (bestLag > 0 && confidence > 0.1) {
      amplitude = this.estimateSeasonalAmplitude(detrended, bestLag);
    }

    log.debug(
      `[TimeSeriesForecaster] Seasonality: period=${bestLag}, ` +
        `amplitude=${amplitude.toFixed(4)}, confidence=${confidence.toFixed(3)}`
    );

    return {
      period: bestLag,
      amplitude,
      confidence,
    };
  }

  // ─── STL-like Decomposition ───────────────

  /**
   * Decompose a time series into trend, seasonal, and residual components.
   * Inspired by STL (Seasonal-Trend decomposition using Loess) but uses
   * moving averages for trend extraction and period-averaging for seasonal.
   */
  decompose(data: number[]): DecompositionResult {
    const n = data.length;

    if (n < 4) {
      return {
        trend: [...data],
        seasonal: new Array(n).fill(0),
        residual: new Array(n).fill(0),
      };
    }

    // Step 1: Extract trend using centered moving average
    // Choose window size based on detected seasonality or default
    const seasonality = this.detectSeasonality(data);
    let windowSize = seasonality.period > 1 ? seasonality.period : Math.max(3, Math.floor(n / 5));

    // Ensure window is odd for symmetric averaging
    if (windowSize % 2 === 0) windowSize++;
    windowSize = Math.min(windowSize, n);

    const trend = this.centeredMovingAverage(data, windowSize);

    // Step 2: De-trend the data
    const detrended: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      detrended[i] = data[i] - trend[i];
    }

    // Step 3: Extract seasonal component by averaging across periods
    const seasonal: number[] = new Array(n).fill(0);
    if (seasonality.period > 1 && seasonality.confidence > 0.1) {
      const period = seasonality.period;
      // Average each position within the cycle
      const periodAverages: number[] = new Array(period).fill(0);
      const periodCounts: number[] = new Array(period).fill(0);

      for (let i = 0; i < n; i++) {
        const pos = i % period;
        periodAverages[pos] += detrended[i];
        periodCounts[pos]++;
      }

      for (let p = 0; p < period; p++) {
        if (periodCounts[p] > 0) {
          periodAverages[p] /= periodCounts[p];
        }
      }

      // Remove mean from seasonal component (zero-mean seasonal)
      const seasonalMean = mean(periodAverages);
      for (let p = 0; p < period; p++) {
        periodAverages[p] -= seasonalMean;
      }

      // Tile the seasonal pattern across the full series
      for (let i = 0; i < n; i++) {
        seasonal[i] = periodAverages[i % period];
      }
    }

    // Step 4: Residual = data - trend - seasonal
    const residual: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      residual[i] = data[i] - trend[i] - seasonal[i];
    }

    log.info(
      `[TimeSeriesForecaster] Decomposition complete: trend + seasonal(period=${seasonality.period}) + residual`
    );

    return { trend, seasonal, residual };
  }

  // ─────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────

  /**
   * Build prediction points from a last value and slope, with confidence intervals.
   */
  private buildPredictions(
    lastValue: number,
    slope: number,
    horizon: number,
    residuals: number[],
    confidenceLevel: number,
    dataLength: number
  ): ForecastPoint[] {
    const predictions: ForecastPoint[] = [];
    const z = zScoreForConfidence(confidenceLevel);
    const residualStd = residuals.length > 1 ? stddev(residuals) : 0;

    for (let h = 1; h <= horizon; h++) {
      const value = lastValue + slope * h;
      // Uncertainty grows with sqrt of horizon step
      const uncertainty = z * residualStd * Math.sqrt(h);

      predictions.push({
        time: dataLength - 1 + h,
        value,
        lower: value - uncertainty,
        upper: value + uncertainty,
      });
    }

    return predictions;
  }

  /**
   * Compute OLS slope for two arrays.
   */
  private olsSlope(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const mx = mean(x.slice(0, n));
    const my = mean(y.slice(0, n));

    let ssxy = 0;
    let ssxx = 0;
    for (let i = 0; i < n; i++) {
      ssxy += (x[i] - mx) * (y[i] - my);
      ssxx += (x[i] - mx) * (x[i] - mx);
    }

    return ssxx === 0 ? 0 : ssxy / ssxx;
  }

  /**
   * Compute R-squared between actual and predicted arrays.
   */
  private computeR2(actual: number[], predicted: number[]): number {
    const n = Math.min(actual.length, predicted.length);
    if (n < 2) return 0;

    const m = mean(actual.slice(0, n));
    let ssTot = 0;
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      ssTot += (actual[i] - m) * (actual[i] - m);
      ssRes += (actual[i] - predicted[i]) * (actual[i] - predicted[i]);
    }

    if (ssTot === 0) return 0;
    return 1 - ssRes / ssTot;
  }

  /**
   * Compute accuracy metrics between actuals and predictions.
   */
  private computeMetrics(actuals: number[], predicted: number[]): AccuracyMetrics {
    const n = Math.min(actuals.length, predicted.length);
    if (n === 0) return { mae: 0, rmse: 0, mape: 0, r2: 0 };

    let sumAbsErr = 0;
    let sumSqErr = 0;
    let sumPctErr = 0;
    let validPct = 0;

    for (let i = 0; i < n; i++) {
      const err = actuals[i] - predicted[i];
      sumAbsErr += Math.abs(err);
      sumSqErr += err * err;
      if (Math.abs(actuals[i]) > 1e-10) {
        sumPctErr += Math.abs(err / actuals[i]);
        validPct++;
      }
    }

    const mae = sumAbsErr / n;
    const rmse = Math.sqrt(sumSqErr / n);
    const mape = validPct > 0 ? sumPctErr / validPct : 0;
    const r2 = this.computeR2(actuals.slice(0, n), predicted.slice(0, n));

    return { mae, rmse, mape, r2 };
  }

  /**
   * Compute in-sample accuracy for a specific model type (used for ensemble weighting).
   */
  private computeInSampleAccuracy(
    data: number[],
    modelType: 'ema' | 'linear_regression' | 'arima_simple'
  ): { mae: number; residualStd: number } {
    const n = data.length;
    if (n < 3) return { mae: 1, residualStd: 1 };

    let fitted: number[];

    switch (modelType) {
      case 'ema': {
        const alpha = this.EMA_ALPHA;
        fitted = new Array(n);
        fitted[0] = data[0];
        for (let i = 1; i < n; i++) {
          fitted[i] = alpha * data[i] + (1 - alpha) * fitted[i - 1];
        }
        // One-step-ahead residuals
        const residuals: number[] = [];
        for (let i = 1; i < n; i++) {
          residuals.push(Math.abs(data[i] - fitted[i - 1]));
        }
        return { mae: mean(residuals), residualStd: stddev(residuals) };
      }
      case 'linear_regression': {
        const x = data.map((_, i) => i);
        const slope = this.olsSlope(x, data);
        const intercept = mean(data) - slope * mean(x);
        fitted = data.map((_, i) => slope * i + intercept);
        const residuals: number[] = [];
        for (let i = 0; i < n; i++) {
          residuals.push(Math.abs(data[i] - fitted[i]));
        }
        return { mae: mean(residuals), residualStd: stddev(residuals) };
      }
      case 'arima_simple': {
        const m = mean(data);
        const demeaned = data.map((v) => v - m);
        const xLag = demeaned.slice(0, n - 1);
        const xCurr = demeaned.slice(1, n);

        let sumXY = 0;
        let sumXX = 0;
        for (let i = 0; i < xLag.length; i++) {
          sumXY += xLag[i] * xCurr[i];
          sumXX += xLag[i] * xLag[i];
        }
        let phi = sumXX === 0 ? 0 : sumXY / sumXX;
        phi = Math.max(-0.999, Math.min(0.999, phi));

        const residuals: number[] = [];
        for (let i = 1; i < n; i++) {
          const pred = phi * demeaned[i - 1] + m;
          residuals.push(Math.abs(data[i] - pred));
        }
        return { mae: mean(residuals), residualStd: stddev(residuals) };
      }
    }
  }

  /**
   * Detect change points using a CUSUM-inspired method on rolling mean differences.
   */
  private detectChangePoints(data: number[]): number[] {
    const n = data.length;
    const w = this.CHANGE_POINT_WINDOW;
    const changePoints: number[] = [];

    if (n < 2 * w + 1) return changePoints;

    // Compute rolling means for left and right windows
    const rollingMeans: number[] = [];
    for (let i = 0; i < n; i++) {
      const left = Math.max(0, i - w);
      const right = Math.min(n - 1, i + w);
      let sum = 0;
      let count = 0;
      for (let j = left; j <= right; j++) {
        sum += data[j];
        count++;
      }
      rollingMeans.push(sum / count);
    }

    // Detect where the difference between right-window mean and left-window mean is large
    const diffs: number[] = [];
    for (let i = w; i < n - w; i++) {
      let leftSum = 0;
      let rightSum = 0;
      for (let j = i - w; j < i; j++) {
        leftSum += data[j];
      }
      for (let j = i; j < i + w; j++) {
        rightSum += data[j];
      }
      const leftMean = leftSum / w;
      const rightMean = rightSum / w;
      diffs.push(rightMean - leftMean);
    }

    if (diffs.length < 2) return changePoints;

    const diffStd = stddev(diffs);
    const threshold = 2 * diffStd; // 2-sigma threshold

    for (let i = 1; i < diffs.length; i++) {
      // Sign change in the difference = change point in the trend
      if (diffs[i - 1] * diffs[i] < 0 && Math.abs(diffs[i] - diffs[i - 1]) > threshold) {
        changePoints.push(i + w); // Adjust for the window offset
      }
    }

    return changePoints;
  }

  /**
   * Centered moving average with edge padding.
   */
  private centeredMovingAverage(data: number[], windowSize: number): number[] {
    const n = data.length;
    const result: number[] = new Array(n);
    const half = Math.floor(windowSize / 2);

    for (let i = 0; i < n; i++) {
      const left = Math.max(0, i - half);
      const right = Math.min(n - 1, i + half);
      let sum = 0;
      let count = 0;
      for (let j = left; j <= right; j++) {
        sum += data[j];
        count++;
      }
      result[i] = sum / count;
    }

    return result;
  }

  /**
   * Estimate the amplitude of a seasonal pattern.
   */
  private estimateSeasonalAmplitude(detrended: number[], period: number): number {
    const n = detrended.length;
    const periodAverages: number[] = new Array(period).fill(0);
    const periodCounts: number[] = new Array(period).fill(0);

    for (let i = 0; i < n; i++) {
      const pos = i % period;
      periodAverages[pos] += detrended[i];
      periodCounts[pos]++;
    }

    for (let p = 0; p < period; p++) {
      if (periodCounts[p] > 0) {
        periodAverages[p] /= periodCounts[p];
      }
    }

    // Amplitude = (max - min) / 2
    let maxVal = -Infinity;
    let minVal = Infinity;
    for (let p = 0; p < period; p++) {
      if (periodAverages[p] > maxVal) maxVal = periodAverages[p];
      if (periodAverages[p] < minVal) minVal = periodAverages[p];
    }

    return (maxVal - minVal) / 2;
  }

  /**
   * Return an empty result for error/edge cases.
   */
  private emptyResult(config: ModelConfig, dataLength: number, durationMs: number): ForecastResult {
    return {
      predictions: [],
      model: config.type,
      accuracy: { mae: 0, rmse: 0, mape: 0, r2: 0 },
      trainingSamples: dataLength,
      durationMs,
    };
  }
}

export default TimeSeriesForecaster;
