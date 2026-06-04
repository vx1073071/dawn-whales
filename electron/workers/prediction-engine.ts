// T73: Prediction Model Engine
export interface PredictionInput {
  features: number[];
  label?: number;
}

export interface PredictionResult {
  value: number;
  confidence: number;
  metadata?: Record<string, any>;
}

// Simple Linear Regression
export class LinearRegression {
  private weights: number[] = [];
  private bias = 0;
  private trained = false;
  private errors: number[] = [];

  train(data: PredictionInput[], learningRate = 0.01, epochs = 100): number {
    if (data.length === 0) return 0;
    const n = data[0].features.length;
    this.weights = new Array(n).fill(0);
    this.bias = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      for (const row of data) {
        if (row.label === undefined) continue;
        const predicted = this._predict(row.features);
        const error = row.label - predicted;
        totalError += error * error;
        for (let i = 0; i < n; i++) {
          this.weights[i] += learningRate * error * row.features[i];
        }
        this.bias += learningRate * error;
      }
      this.errors.push(totalError / data.length);
    }
    this.trained = true;
    return this.errors[this.errors.length - 1];
  }

  predict(features: number[]): PredictionResult {
    if (!this.trained) throw new Error('Model not trained');
    const value = this._predict(features);
    // Confidence: inverse of training error (capped)
    const mse = this.errors[this.errors.length - 1] || 1;
    const confidence = Math.min(1, 1 / (1 + mse));
    return { value, confidence };
  }

  private _predict(features: number[]): number {
    let sum = this.bias;
    for (let i = 0; i < this.weights.length; i++) {
      sum += this.weights[i] * (features[i] || 0);
    }
    return sum;
  }

  getWeights(): { weights: number[]; bias: number } {
    return { weights: [...this.weights], bias: this.bias };
  }

  getErrorHistory(): number[] {
    return [...this.errors];
  }
}

// Simple Moving Average predictor
export class SMAPredictor {
  private window: number;

  constructor(window = 20) {
    this.window = window;
  }

  predict(series: number[]): PredictionResult {
    if (series.length < this.window) {
      return { value: series[series.length - 1] || 0, confidence: 0.1 };
    }
    const recent = series.slice(-this.window);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const std = Math.sqrt(
      recent.reduce((s, v) => s + (v - avg) ** 2, 0) / recent.length
    );
    // Confidence based on coefficient of variation
    const cv = std / (Math.abs(avg) || 1);
    const confidence = Math.min(1, 1 / (1 + cv));
    return { value: avg, confidence };
  }
}

// Ensemble predictor
export class EnsemblePredictor {
  private models: { name: string; predict: (features: number[]) => PredictionResult; weight: number }[] = [];

  addModel(name: string, predict: (features: number[]) => PredictionResult, weight = 1): void {
    this.models.push({ name, predict, weight });
  }

  predict(features: number[]): PredictionResult {
    if (this.models.length === 0) return { value: 0, confidence: 0 };
    const totalWeight = this.models.reduce((s, m) => s + m.weight, 0);
    let weightedValue = 0;
    let weightedConfidence = 0;
    for (const model of this.models) {
      const result = model.predict(features);
      weightedValue += result.value * model.weight;
      weightedConfidence += result.confidence * model.weight;
    }
    return {
      value: weightedValue / totalWeight,
      confidence: weightedConfidence / totalWeight,
      metadata: {
        modelCount: this.models.length,
        individualResults: this.models.map(m => ({
          name: m.name,
          ...m.predict(features),
        })),
      },
    };
  }
}
