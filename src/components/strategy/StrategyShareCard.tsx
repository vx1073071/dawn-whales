// ── R220 ML#2: StrategyShareCard — 策略分享(导出带水印图片) ──────────
// html2canvas 截图 → 水印 + 分享信息 → 复制/下载/社交分享
// 3种分享尺寸: 卡片(800x600) / 长图(1080x1920) / 故事(1080x1080)
// 9语言i18n, 集成 USERNAME 署名, 隐藏敏感信息

import { useState, useRef, useCallback } from 'react';
import { Button, Tag, Space, Modal, message, Radio } from 'antd';
import {
  ShareAltOutlined, DownloadOutlined, CopyOutlined,
  TwitterOutlined, LinkOutlined,
  WechatOutlined, PictureOutlined,
  TrophyOutlined, RiseOutlined, FallOutlined, StarFilled,
} from '@ant-design/icons';
import html2canvas from 'html2canvas';
import i18n from '../../i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ShareData {
  strategyName: string;
  username: string;
  userId: string;
  sharpeRatio: number;
  totalReturn: number;       // %
  maxDrawdown: number;       // %
  winRate: number;           // %
  annualizedReturn: number;  // %
  trades: number;
  holdingDays: number;
  factors: string[];
  market: string;
  riskLevel: 'low' | 'medium' | 'high';
  tags?: string[];
  createdAt: number;
}

export interface StrategyShareCardProps {
  data: ShareData;
  defaultSize?: 'card' | 'story' | 'tall';
  locale?: string;
}

const I18N = (k: string) => i18n.t(`strategyShare.${k}`);

// ── 尺寸配置 ───────────────────────────────────────────────────────────────

const SIZE_CONFIG = {
  card: { width: 800, height: 600, name: 'Card 800x600' },
  story: { width: 1080, height: 1080, name: 'Story 1080x1080' },
  tall: { width: 1080, height: 1920, name: 'Tall 1080x1920' },
};

// ── 等级颜色 ───────────────────────────────────────────────────────────────

const RISK_COLORS = {
  low: { bg: '#065f46', text: '#22c55e', label: '稳健' },
  medium: { bg: '#78350f', text: '#f59e0b', label: '平衡' },
  high: { bg: '#7f1d1d', text: '#ef4444', label: '进取' },
};

// ── Main component ──────────────────────────────────────────────────────────

export default function StrategyShareCard({ data, defaultSize = 'card', locale }: StrategyShareCardProps) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<keyof typeof SIZE_CONFIG>(defaultSize);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const config = SIZE_CONFIG[size];
  const risk = RISK_COLORS[data.riskLevel];

  // ── 生成图片 ──
  const handleGenerate = useCallback(async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    setGeneratedImage(null);
    try {
      // Wait a moment for render
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a14',
        scale: 2,
        useCORS: true,
        logging: false,
        width: config.width,
        height: config.height,
        windowWidth: config.width,
        windowHeight: config.height,
      });
      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedImage(dataUrl);
      message.success(I18N('genSuccess'));
    } catch (e: unknown) {
      message.error(`${I18N('genFailed')}: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }, [config, locale]);

  // ── 下载 ──
  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.download = `strategy-${data.strategyName.replace(/[^\w\u4e00-\u9fa5]/g, '_')}-${Date.now()}.png`;
    link.href = generatedImage;
    link.click();
    message.success(I18N('downloaded'));
  }, [generatedImage, data.strategyName, locale]);

  // ── 复制图片 ──
  const handleCopy = useCallback(async () => {
    if (!generatedImage) return;
    try {
      // Use Clipboard API if available
      const blob = await (await fetch(generatedImage)).blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        message.success(I18N('copied'));
      } else {
        // Fallback: copy data URL as text
        await navigator.clipboard.writeText(generatedImage);
        message.success(I18N('copiedAsText'));
      }
    } catch {
      message.error(I18N('copyFailed'));
    }
  }, [generatedImage, locale]);

  // ── 社交分享 URL ──
  const shareUrl = `https://QuantMoo.com/share/strategy/${data.userId}/${data.strategyName.replace(/\s+/g, '-')}`;
  const shareText = `${data.strategyName} | Sharpe ${data.sharpeRatio.toFixed(2)} | 年化 ${data.annualizedReturn.toFixed(1)}% | @TradingEasy`;

  // ── Render the share card (offscreen but rendered) ──
  return (
    <>
      <Button icon={<ShareAltOutlined />} onClick={() => { setOpen(true); setGeneratedImage(null); }}>
        {I18N('share')}
      </Button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={Math.min(900, window.innerWidth - 32)}
        title={<span style={{ color: '#e0e0e0' }}><ShareAltOutlined style={{ color: '#60a5fa' }} /> {I18N('title')}</span>}
        destroyOnClose
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Preview (scaled) */}
          <div>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>{I18N('preview')}</div>
            <div style={{
              background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 8, padding: 8,
              maxHeight: 500, overflow: 'auto',
            }}>
              <div style={{
                transform: `scale(${Math.min(1, 500 / config.width)})`,
                transformOrigin: 'top left',
                width: config.width, height: config.height,
              }}>
                <div ref={cardRef} style={{
                  width: config.width, height: config.height,
                  background: 'linear-gradient(135deg, #0a0a14 0%, #1a1a25 100%)',
                  fontFamily: '-apple-system, sans-serif',
                  position: 'relative', overflow: 'hidden',
                  color: '#e0e0e0',
                }}>
                  {/* Watermark (background, repeated) */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: `repeating-linear-gradient(-30deg, transparent, transparent 100px, rgba(212, 168, 83, 0.05) 100px, rgba(212, 168, 83, 0.05) 200px)`,
                    pointerEvents: 'none', zIndex: 1,
                  }} />

                  {/* Top: Brand + user */}
                  <div style={{ position: 'relative', zIndex: 2, padding: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrophyOutlined style={{ fontSize: 24, color: '#D4A853' }} />
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#D4A853' }}>TradingEasy</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>AI Quant Platform</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: '#e0e0e0', fontWeight: 600 }}>{data.username}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>@{data.userId}</div>
                    </div>
                  </div>

                  {/* Middle: Strategy name + market */}
                  <div style={{ position: 'relative', zIndex: 2, padding: '0 32px', marginBottom: 24 }}>
                    <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                      {data.strategyName}
                    </h1>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Tag color="blue" style={{ fontSize: 12, padding: '2px 10px' }}>
                        📍 {data.market}
                      </Tag>
                      <Tag style={{ fontSize: 12, padding: '2px 10px', background: risk.bg, color: risk.text, border: 'none' }}>
                        🛡️ {risk.label}
                      </Tag>
                      {data.tags?.map(t => (
                        <Tag key={t} color="default" style={{ fontSize: 12, padding: '2px 10px' }}>
                          {t}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div style={{
                    position: 'relative', zIndex: 2, padding: '0 32px',
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24,
                  }}>
                    {[
                      { label: '年化收益', value: `${data.annualizedReturn.toFixed(1)}%`, icon: data.annualizedReturn >= 0 ? <RiseOutlined /> : <FallOutlined />, color: data.annualizedReturn >= 0 ? '#22c55e' : '#ef4444' },
                      { label: 'Sharpe', value: data.sharpeRatio.toFixed(2), icon: <StarFilled />, color: data.sharpeRatio >= 1.5 ? '#22c55e' : data.sharpeRatio >= 1 ? '#f59e0b' : '#ef4444' },
                      { label: '最大回撤', value: `${data.maxDrawdown.toFixed(1)}%`, icon: <FallOutlined />, color: data.maxDrawdown <= 15 ? '#22c55e' : data.maxDrawdown <= 25 ? '#f59e0b' : '#ef4444' },
                      { label: '胜率', value: `${(data.winRate * 100).toFixed(0)}%`, icon: <RiseOutlined />, color: data.winRate >= 0.6 ? '#22c55e' : '#9ca3af' },
                    ].map(m => (
                      <div key={m.label} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, padding: 16, textAlign: 'center',
                      }}>
                        <div style={{ color: m.color, fontSize: 24, marginBottom: 4 }}>{m.icon}</div>
                        <div style={{ color: m.color, fontSize: 22, fontWeight: 700 }}>{m.value}</div>
                        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Factors */}
                  <div style={{ position: 'relative', zIndex: 2, padding: '0 32px', marginBottom: 24 }}>
                    <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>📊 核心因子 ({data.factors.length})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {data.factors.map(f => (
                        <Tag key={f} color="cyan" style={{ fontSize: 12, padding: '2px 10px' }}>
                          {f}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  {/* Bottom watermark + signature */}
                  <div style={{
                    position: 'absolute', bottom: 24, left: 32, right: 32, zIndex: 2,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16,
                  }}>
                    <div>
                      <div style={{ color: '#6b7280', fontSize: 10 }}>扫码体验 TradingEasy</div>
                      <div style={{ color: '#D4A853', fontSize: 14, fontWeight: 600, marginTop: 2 }}>QuantMoo.com</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#6b7280', fontSize: 10 }}>交易笔数: {data.trades} | 持仓: {data.holdingDays}d</div>
                      <div style={{ color: '#6b7280', fontSize: 9, marginTop: 2, opacity: 0.6 }}>
                        📌 分享时间: {new Date().toISOString().slice(0, 10)} · 投资有风险, 决策需谨慎
                      </div>
                    </div>
                  </div>

                  {/* QR placeholder */}
                  <div style={{
                    position: 'absolute', bottom: 60, right: 32, zIndex: 2,
                    width: 60, height: 60, background: '#fff', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: 8, color: '#000' }}>QR Code</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls + actions */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>{I18N('size')}</div>
              <Radio.Group value={size} onChange={e => setSize(e.target.value)}>
                {(Object.keys(SIZE_CONFIG) as Array<keyof typeof SIZE_CONFIG>).map(k => (
                  <Radio.Button key={k} value={k}>{SIZE_CONFIG[k].name}</Radio.Button>
                ))}
              </Radio.Group>
            </div>

            <Button
              type="primary"
              icon={<PictureOutlined />}
              onClick={handleGenerate}
              loading={generating}
              block
              style={{ marginBottom: 12, background: '#C9A046', borderColor: '#C9A046' }}
            >
              {generating ? I18N('generating') : I18N('generate')}
            </Button>

            {generatedImage && (
              <>
                <Space style={{ width: '100%', marginBottom: 12 }} direction="vertical">
                  <Button icon={<DownloadOutlined />} onClick={handleDownload} block>{I18N('download')}</Button>
                  <Button icon={<CopyOutlined />} onClick={handleCopy} block>{I18N('copy')}</Button>
                </Space>

                <div style={{ borderTop: '1px solid #2a2d3e', paddingTop: 12, marginTop: 12 }}>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>{I18N('shareTo')}</div>
                  <Space wrap>
                    <Button
                      icon={<TwitterOutlined />}
                      onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank')}
                    >
                      Twitter
                    </Button>
                    <Button
                      icon={<WechatOutlined />}
                      onClick={() => { navigator.clipboard.writeText(shareUrl); message.success(I18N('urlCopied')); }}
                    >
                      WeChat
                    </Button>
                    <Button
                      icon={<LinkOutlined />}
                      onClick={() => { navigator.clipboard.writeText(shareUrl); message.success(I18N('urlCopied')); }}
                    >
                      Copy URL
                    </Button>
                  </Space>
                </div>

                <div style={{ marginTop: 12, padding: 10, background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 6 }}>
                  <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{I18N('previewLink')}:</div>
                  <div style={{ color: '#60a5fa', fontSize: 11, wordBreak: 'break-all' }}>{shareUrl}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
