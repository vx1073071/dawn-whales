// ── R207 ML P7: TemplateMeta — 模板评分/收藏/最近使用 ──────────
// ⭐ Rate (1-5 stars), ❤️ Favorite, 🕒 Recently used (localStorage)
// Persistent across sessions via localStorage
// Star rating click-based, favorites toggle, recents list (last 5)

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Tooltip, Empty, Popconfirm } from 'antd';
import { StarFilled, StarOutlined, HeartFilled, HeartOutlined, ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';

interface Props {
  templateId?: string;
  templateName?: string;
  templateNameCN?: string;
  category?: string;
  market?: string;
  onRate?: (templateId: string, rating: number) => void;
  onFavorite?: (templateId: string, favorited: boolean) => void;
  onSelectRecent?: (templateId: string) => void;
  locale?: string;
}

const L18N: Record<string, Record<string, string>> = {
  zhCN: {
    rate:'评分',favorite:'收藏',unfavorite:'取消收藏',
    recent:'最近使用',noRecent:'暂无使用记录',
    clearRecents:'清除记录',confirm:'确认清除所有使用记录？',
    yes:'确认',no:'取消',used:'次使用',
    rating:'编辑评分',
  },
  en: {
    rate:'Rate',favorite:'Favorite',unfavorite:'Unfavorite',
    recent:'Recently Used',noRecent:'No recent templates',
    clearRecents:'Clear History',confirm:'Clear all recent records?',
    yes:'Yes',no:'No',used:'uses',
    rating:'Rate',
  },
};

const T = (k: string, l: string): string => (L18N[l]||L18N.en)[k]||k;

const STORAGE_KEY_RATINGS = 'dw_template_ratings';
const STORAGE_KEY_FAVORITES = 'dw_template_favorites';
const STORAGE_KEY_RECENTS = 'dw_template_recents';
const MAX_RECENTS = 5;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveToStorage(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const TemplateMeta: React.FC<Props> = ({
  templateId, templateName, templateNameCN, category, market,
  onRate, onFavorite, onSelectRecent, locale: pl,
}) => {
  const l = pl === 'zh-CN' ? 'zhCN' : 'en';

  // State from localStorage
  const [ratings, setRatings] = useState<Record<string,number>>(()=>loadFromStorage(STORAGE_KEY_RATINGS,{}));
  const [favorites, setFavorites] = useState<Set<string>>(()=>new Set(loadFromStorage<string[]>(STORAGE_KEY_FAVORITES,[])));
  const [recents, setRecents] = useState<{id:string;name:string;nameCN:string;cat:string;market:string;ts:number}[]>(
    ()=>loadFromStorage(STORAGE_KEY_RECENTS,[])
  );

  const currentRating = templateId ? (ratings[templateId]||0) : 0;
  const isFavorited = templateId ? favorites.has(templateId) : false;
  const recentList = recents.slice(0, MAX_RECENTS);

  // Track usage
  useEffect(() => {
    if (!templateId || !templateName) return;
    setRecents(prev=>{
      const filtered = prev.filter(r=>r.id!==templateId);
      const updated = [{id:templateId,name:templateName,nameCN:templateNameCN||templateName,cat:category||'',market:market||'',ts:Date.now()}, ...filtered].slice(0, MAX_RECENTS);
      saveToStorage(STORAGE_KEY_RECENTS, updated);
      return updated;
    });
  }, [templateId]);

  const handleRate = useCallback((rating: number) => {
    if (!templateId) return;
    const updated = {...ratings, [templateId]:rating};
    setRatings(updated); saveToStorage(STORAGE_KEY_RATINGS, updated);
    onRate?.(templateId, rating);
  }, [templateId, ratings, onRate]);

  const handleFavorite = useCallback(() => {
    if (!templateId) return;
    const newSet = new Set(favorites);
    if (newSet.has(templateId)) newSet.delete(templateId);
    else newSet.add(templateId);
    setFavorites(newSet); saveToStorage(STORAGE_KEY_FAVORITES, [...newSet]);
    onFavorite?.(templateId, newSet.has(templateId));
  }, [templateId, favorites, onFavorite]);

  const handleClearRecents = useCallback(() => {
    setRecents([]); saveToStorage(STORAGE_KEY_RECENTS, []);
  }, []);

  return (
    <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',borderRadius:12,padding:20,border:'1px solid rgba(74,144,217,0.15)'}}>
      {/* Rating + Favorite row */}
      {templateId && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          {/* Star Rating */}
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{color:'#909090',fontSize:11,marginRight:4}}>{T('rate',l)}:</span>
            {[1,2,3,4,5].map(star=>{
              const active = star <= currentRating;
              return (
                <Tooltip key={star} title={T('rating',l)}>
                  <span onClick={()=>handleRate(star)}
                    style={{cursor:'pointer',fontSize:18,color:active?'#d4a853':'rgba(255,255,255,0.15)',transition:'color .15s'}}>
                    {active?<StarFilled/>:<StarOutlined/>}
                  </span>
                </Tooltip>
              );
            })}
            {currentRating>0&&<span style={{color:'#d4a853',fontSize:12,fontWeight:600,marginLeft:4}}>{currentRating}/5</span>}
          </div>

          {/* Favorite toggle */}
          <Tooltip title={isFavorited?T('unfavorite',l):T('favorite',l)}>
            <Button type="text" icon={isFavorited?<HeartFilled style={{color:'#ff4d4f'}}/>:<HeartOutlined style={{color:'#909090'}}/>}
              onClick={handleFavorite} style={{fontSize:16}}/>
          </Tooltip>
        </div>
      )}

      {/* Recents */}
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <ClockCircleOutlined style={{color:'#4a90d9'}}/>
            <span style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{T('recent',l)}</span>
          </div>
          {recentList.length>0&&(
            <Popconfirm title={T('confirm',l)} onConfirm={handleClearRecents}
              okText={T('yes',l)} cancelText={T('no',l)}>
              <Button type="text" size="small" icon={<DeleteOutlined/>}
                style={{color:'#909090',fontSize:11}}>{T('clearRecents',l)}</Button>
            </Popconfirm>
          )}
        </div>

        {recentList.length>0?(
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {recentList.map((r,_i)=>{
              const fav = favorites.has(r.id);
              const rate = ratings[r.id]||0;
              const ago = getTimeAgo(r.ts, l);
              return (
                <div key={r.id} onClick={()=>onSelectRecent?.(r.id)}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,cursor:'pointer'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{color:'#e8e8e8',fontSize:12,fontWeight:600}}>{l==='zhCN'?r.nameCN:r.name}</span>
                      {fav&&<HeartFilled style={{color:'#ff4d4f',fontSize:10}}/>}
                      {rate>0&&<span style={{color:'#d4a853',fontSize:10}}>{'⭐'.repeat(rate)}</span>}
                    </div>
                    <div style={{color:'#909090',fontSize:9}}>{r.cat} · {r.market}</div>
                  </div>
                  <span style={{color:'#666',fontSize:10}}>{ago}</span>
                </div>
              );
            })}
          </div>
        ):(
          <Empty description={<span style={{color:'#666',fontSize:11}}>{T('noRecent',l)}</span>} image={Empty.PRESENTED_IMAGE_SIMPLE}/>
        )}
      </div>
    </div>
  );
};

function getTimeAgo(ts: number, l: string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff/60000);
  if (mins < 1) return l==='zhCN'?'刚刚':'just now';
  if (mins < 60) return mins+ (l==='zhCN'?'分钟前':'m ago');
  const hrs = Math.floor(mins/60);
  if (hrs < 24) return hrs+ (l==='zhCN'?'小时前':'h ago');
  const days = Math.floor(hrs/24);
  return days+ (l==='zhCN'?'天前':'d ago');
}

export default TemplateMeta;
