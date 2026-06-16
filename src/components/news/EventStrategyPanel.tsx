// @ts-nocheck
// R242 ML#3: EventStrategyPanel — Event-driven strategy creation
// Event type → AI suggestion → 1-click apply parameters to strategy
import React, { useState } from 'react';

export interface EventType {
  id: string;
  name: string;
  icon: string;
  description: string;
  avgDuration: string;
  reliability: number; // %
}

export interface AISuggestion {
  eventId: string;
  strategyName: string;
  confidence: number;
  rationale: string;
  suggestedParams: { key: string; label: string; value: number; reason: string }[];
  expectedReturn: number;
  riskLevel: 'low' | 'medium' | 'high';
  cost: number; // USDT
}

export interface EventStrategyPanelProps {
  eventTypes: EventType[];
  suggestions: AISuggestion[];
  onSelectEvent: (eventId: string) => void;
  onApplyParams: (suggestion: AISuggestion) => void;
  onGenerateSuggestion: (eventId: string) => void;
  isGenerating?: boolean;
  className?: string;
}

const EVENT_TYPES: EventType[] = [
  { id: 'earnings', name: 'Earnings Report', icon: '💰', description: 'Quarterly earnings releases', avgDuration: '3-5 days', reliability: 68 },
  { id: 'fed', name: 'Fed Decision', icon: '🏦', description: 'FOMC rate decisions', avgDuration: '1-2 days', reliability: 72 },
  { id: 'cpi', name: 'CPI Release', icon: '📊', description: 'Inflation data releases', avgDuration: '1 day', reliability: 65 },
  { id: 'geopolitical', name: 'Geopolitical', icon: '🌍', description: 'Trade wars, conflicts, sanctions', avgDuration: '5-20 days', reliability: 45 },
  { id: 'sector_rotation', name: 'Sector Rotation', icon: '🔄', description: 'Market sector shifts', avgDuration: '7-14 days', reliability: 55 },
  { id: 'crypto_event', name: 'Crypto Event', icon: '₿', description: 'Halving, ETF, regulation', avgDuration: '3-10 days', reliability: 60 },
];

export default function EventStrategyPanel({
  eventTypes = EVENT_TYPES, suggestions, onSelectEvent, onApplyParams, onGenerateSuggestion, isGenerating, className = '',
}: EventStrategyPanelProps) {
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  
  const currentSuggestion = suggestions.find(s => s.eventId === selectedEvent);
  
  const handleGenerate = (eventId: string) => {
    setSelectedEvent(eventId);
    onSelectEvent(eventId);
    onGenerateSuggestion(eventId);
  };
  
  return React.createElement('div', { className: `event-strategy ${className}`, style: { display: 'flex', flexDirection: 'column', height: '100%', padding: 14 } }, [
    React.createElement('div', { key: 'title', style: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', marginBottom: 12 } }, '🎯 Event Strategy Builder'),
    
    // Event type cards
    React.createElement('div', { key: 'events', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 14 } },
      eventTypes.map(evt =>
        React.createElement('div', { key: evt.id, style: {
          padding: 10, borderRadius: 8, cursor: 'pointer',
          border: selectedEvent === evt.id ? '1px solid var(--brand, #d4a574)' : '1px solid var(--border-color, #334155)',
          background: selectedEvent === evt.id ? 'var(--brand-bg, rgba(212,165,116,0.1))' : 'var(--surface-2, #1e293b)',
        }, onClick: () => handleGenerate(evt.id) }, [
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } }, [
            React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, `${evt.icon} ${evt.name}`),
            React.createElement('span', { style: { fontSize: 10, color: evt.reliability >= 65 ? '#22c55e' : '#f59e0b', fontWeight: 600 } }, `${evt.reliability}%`),
          ]),
          React.createElement('div', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)', lineHeight: 1.5 } }, evt.description),
        ])
      )
    ),
    
    // AI Suggestion panel
    selectedEvent && React.createElement('div', { key: 'suggestion', style: { flex: 1, display: 'flex', flexDirection: 'column' } }, [
      isGenerating
        ? React.createElement('div', { style: { padding: 20, textAlign: 'center', color: 'var(--text-tertiary, #64748b)' } }, '🤖 AI analyzing event patterns...')
        : currentSuggestion && React.createElement('div', {}, [
            // Header
            React.createElement('div', { key: 'header', style: {
              padding: 12, borderRadius: 8, marginBottom: 12,
              background: 'var(--surface-2, #1e293b)', border: '1px solid var(--border-color, #334155)',
            }}, [
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 } }, [
                React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, `🤖 ${currentSuggestion.strategyName}`),
                React.createElement('span', { style: { fontSize: 11, padding: '2px 8px', borderRadius: 4, background: currentSuggestion.riskLevel === 'high' ? '#ef444420' : currentSuggestion.riskLevel === 'medium' ? '#f59e0b20' : '#22c55e20', color: currentSuggestion.riskLevel === 'high' ? '#ef4444' : currentSuggestion.riskLevel === 'medium' ? '#f59e0b' : '#22c55e', fontWeight: 600 } }, currentSuggestion.riskLevel.toUpperCase()),
              ]),
              React.createElement('div', { style: { fontSize: 11, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5, marginBottom: 8 } }, currentSuggestion.rationale),
              React.createElement('div', { style: { display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, [
                React.createElement('span', {}, `Confidence: ${currentSuggestion.confidence}%`),
                React.createElement('span', {}, `Est. Return: ${currentSuggestion.expectedReturn >= 0 ? '+' : ''}${currentSuggestion.expectedReturn}%`),
                React.createElement('span', {}, `Cost: ${currentSuggestion.cost}U`),
              ]),
            ]),
            
            // Parameters
            React.createElement('div', { key: 'params', style: { marginBottom: 12 } }, [
              React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: 6 } }, '📋 Suggested Parameters'),
              ...currentSuggestion.suggestedParams.map((p, i) =>
                React.createElement('div', { key: i, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-color, #334155)', fontSize: 11 } }, [
                  React.createElement('div', {}, [
                    React.createElement('span', { style: { color: 'var(--text-primary, #e2e8f0)', fontWeight: 500 } }, p.label),
                    React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)', marginLeft: 8, fontSize: 10 } }, p.reason),
                  ]),
                  React.createElement('span', { style: { color: 'var(--brand, #d4a574)', fontWeight: 600 } }, p.value),
                ])
              ),
            ]),
            
            // Apply button
            React.createElement('button', {
              key: 'apply', onClick: () => onApplyParams(currentSuggestion),
              style: {
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: 'var(--brand, #d4a574)', color: '#000',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              },
            }, `⚡ Apply to Strategy • ${currentSuggestion.cost}U`),
          ]),
    ]),
  ]);
}
