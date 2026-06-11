export interface VolatilityResult {
  value: number;
  type: string;
  annualized: boolean;
  window?: number;
  confidence?: number;
}
export interface GARCHParams {
  omega: number;
  alpha: number;
  beta: number;
  returns: number[];
}
export interface GARCHResult {
  forecasts: number[];
  fittedValues: number[];
  residuals: number[];
  params: { omega: number; alpha: number; beta: number };
  logLikelihood: number;
  aic: number;
  bic: number;
}
export interface VolSurface {
  date: string;
  underlying: number;
  points: {
    strike: number;
    expiry: string;
    iv: number;
    delta: number;
  }[];
}
