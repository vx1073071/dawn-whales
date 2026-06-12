// ── R126-M01 DrawingToolbar增强: 画线OHLC吸附 ──────────────────────────
// PM: P2-5 画线吸附 — 趋势线自动吸附最近OHLC价格点
// 集成到 lightweight-charts 的 primitive 绘制中

import type { KlineBar } from '../../lib/chart/types';

export interface SnapPoint {
  time: number;
  price: number;
  type: 'open' | 'high' | 'low' | 'close';
  distance: number; // pixels from cursor
}

/**
 * 在K线数据中查找离鼠标坐标最近的OHLC价格点
 * @param bars K线数据
 * @param mouseX 鼠标X (canvas坐标)
 * @param mouseY 鼠标Y (canvas坐标)
 * @param timeScale lightweight-charts timeScale
 * @param priceScale lightweight-charts priceScale
 * @param snapRadius 吸附半径 (px)
 */
export function findSnapPoint(
  bars: KlineBar[],
  mouseX: number,
  mouseY: number,
  timeScale: any,
  priceScale: any,
  snapRadius = 12
): SnapPoint | null {
  if (!bars.length || !timeScale || !priceScale) return null;

  let best: SnapPoint | null = null;
  let bestDist = snapRadius;

  for (const bar of bars) {
    const barX = timeScale.timeToCoordinate(bar.time / 1000);
    if (barX === null || Math.abs(barX - mouseX) > snapRadius * 2) continue;

    const ohlc: { type: SnapPoint['type']; price: number }[] = [
      { type: 'open', price: bar.open },
      { type: 'high', price: bar.high },
      { type: 'low', price: bar.low },
      { type: 'close', price: bar.close },
    ];

    for (const { type, price } of ohlc) {
      const priceY = priceScale.priceToCoordinate(price);
      if (priceY === null) continue;
      const dist = Math.sqrt((barX - mouseX) ** 2 + (priceY - mouseY) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = { time: bar.time, price, type, distance: Math.round(dist) };
      }
    }
  }

  return best;
}

/**
 * 在画线过程中应用吸附:
 * 如果找到吸附点 → 返回吸附坐标
 * 如果未找到 → 返回原始坐标
 */
export function applySnap(
  x: number, y: number,
  snapPoint: SnapPoint | null,
  timeScale: any,
  priceScale: any
): { x: number; y: number; snapped: boolean } {
  if (!snapPoint || !timeScale || !priceScale) return { x, y, snapped: false };

  const snapX = timeScale.timeToCoordinate(snapPoint.time / 1000);
  const snapY = priceScale.priceToCoordinate(snapPoint.price);

  if (snapX === null || snapY === null) return { x, y, snapped: false };

  return { x: snapX, y: snapY, snapped: true };
}

// ═══════════ Snap indicator (visual feedback) ═══════════

/**
 * Draw a snap indicator circle at the snapped point
 * Call in lightweight-charts primitive's draw() method
 */
export function drawSnapIndicator(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  snapped: boolean,
  snapPoint?: SnapPoint | null
) {
  if (!snapped || !snapPoint) return;

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#58a6ff';
  ctx.fill();

  // Price label
  const label = `${snapPoint.price.toFixed(2)}`;
  ctx.font = '9px monospace';
  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(x - textWidth / 2 - 4, y - 22, textWidth + 8, 16);
  ctx.strokeStyle = '#58a6ff';
  ctx.strokeRect(x - textWidth / 2 - 4, y - 22, textWidth + 8, 16);
  ctx.fillStyle = '#58a6ff';
  ctx.fillText(label, x - textWidth / 2, y - 10);
}

export default findSnapPoint;
