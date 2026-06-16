/**
 * R236-auto#1: Plugin Marketplace UI Component
 *
 * React component for browsing, installing, and managing plugins.
 * Integrates with usePluginStore for state management.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePluginStore, type PluginInfo, type PluginStatus } from '../stores/pluginStore';

// ── Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PluginStatus }) {
  const styles: Record<PluginStatus, { bg: string; text: string; label: string }> = {
    available: { bg: '#e8f5e9', text: '#2e7d32', label: '可安装' },
    downloading: { bg: '#e3f2fd', text: '#1565c0', label: '下载中' },
    validating: { bg: '#fff3e0', text: '#e65100', label: '校验中' },
    installed: { bg: '#f3e5f5', text: '#7b1fa2', label: '已安装' },
    active: { bg: '#e8f5e9', text: '#2e7d32', label: '运行中' },
    inactive: { bg: '#fafafa', text: '#616161', label: '已停用' },
    error: { bg: '#ffebee', text: '#c62828', label: '异常' },
    uninstalling: { bg: '#fff3e0', text: '#e65100', label: '卸载中' },
  };

  const s = styles[status];
  return (
    <span
      style={{
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 12,
        background: s.bg,
        color: s.text,
        fontWeight: 500,
      }}
    >
      {s.label}
    </span>
  );
}

// ── Plugin Card ───────────────────────────────────────────────────────

function PluginCard({
  plugin,
  onInstall,
  onUninstall,
  onToggle,
}: {
  plugin: PluginInfo;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const isInstalled = plugin.status !== 'available';
  const isActive = plugin.status === 'active';

  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: '#fff',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 32, marginRight: 12 }}>{plugin.icon || '📦'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{plugin.name}</h3>
            <StatusBadge status={plugin.status} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
            {plugin.author.name} · v{plugin.version}
          </p>
        </div>
      </div>

      <p style={{ fontSize: 14, color: '#333', margin: '8px 0', lineHeight: 1.5 }}>
        {plugin.description}
      </p>

      {/* Permissions */}
      {plugin.permissions && plugin.permissions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {plugin.permissions.map((perm) => (
            <span
              key={perm}
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: '#f5f5f5',
                color: '#666',
                marginRight: 4,
              }}
            >
              {perm}
            </span>
          ))}
        </div>
      )}

      {/* Tags */}
      {plugin.tags && plugin.tags.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {plugin.tags.map((tag) => (
            <span key={tag} style={{ fontSize: 11, color: '#999', marginRight: 6 }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Error message */}
      {plugin.status === 'error' && plugin.lastError && (
        <div
          style={{
            fontSize: 12,
            color: '#c62828',
            background: '#ffebee',
            padding: '4px 8px',
            borderRadius: 4,
            marginBottom: 8,
          }}
        >
          ⚠️ {plugin.lastError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!isInstalled && (
          <button
            onClick={() => onInstall(plugin.id)}
            disabled={plugin.status === 'downloading'}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              background: plugin.status === 'downloading' ? '#ccc' : '#1976d2',
              color: '#fff',
              cursor: plugin.status === 'downloading' ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {plugin.status === 'downloading' ? '安装中...' : '安装'}
          </button>
        )}

        {isInstalled && (
          <>
            <button
              onClick={() => onToggle(plugin.id, !isActive)}
              disabled={plugin.status === 'uninstalling'}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: `1px solid ${isActive ? '#c62828' : '#2e7d32'}`,
                background: isActive ? '#ffebee' : '#e8f5e9',
                color: isActive ? '#c62828' : '#2e7d32',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {isActive ? '停用' : '激活'}
            </button>
            <button
              onClick={() => onUninstall(plugin.id)}
              disabled={plugin.status === 'uninstalling'}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid #ddd',
                background: '#fff',
                color: '#666',
                cursor: plugin.status === 'uninstalling' ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {plugin.status === 'uninstalling' ? '卸载中...' : '卸载'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Search Bar ────────────────────────────────────────────────────────

function SearchBar({
  query,
  tags,
  onSearch,
  onTagToggle,
  isLoading,
}: {
  query: string;
  tags: string[];
  onSearch: (q: string) => void;
  onTagToggle: (tag: string) => void;
  isLoading: boolean;
}) {
  const availableTags = ['factor', 'data-source', 'strategy', 'ui', 'indicator', 'example'];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索插件..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #ddd',
            fontSize: 14,
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch(query);
          }}
        />
        <button
          onClick={() => onSearch(query)}
          disabled={isLoading}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: isLoading ? '#ccc' : '#1976d2',
            color: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: 14,
          }}
        >
          {isLoading ? '搜索中...' : '搜索'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {availableTags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTagToggle(tag)}
            style={{
              padding: '4px 12px',
              borderRadius: 16,
              border: `1px solid ${tags.includes(tag) ? '#1976d2' : '#ddd'}`,
              background: tags.includes(tag) ? '#e3f2fd' : '#fff',
              color: tags.includes(tag) ? '#1976d2' : '#666',
              cursor: 'pointer',
              fontSize: 12,
              transition: 'all 0.15s',
            }}
          >
            {tags.includes(tag) ? '✓ ' : ''}#{tag}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
      <p style={{ fontSize: 16, marginBottom: 8 }}>📭</p>
      <p>{message}</p>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────

const TAB_INSTALLED = 'installed' as const;
const TAB_MARKETPLACE = 'marketplace' as const;
type Tab = typeof TAB_INSTALLED | typeof TAB_MARKETPLACE;

export function PluginMarketplace() {
  const store = usePluginStore();
  const [activeTab, setActiveTab] = useState<Tab>(TAB_INSTALLED);

  // Load installed plugins on mount
  useEffect(() => {
    store.loadInstalled();
  }, []);

  // Handle search with debounce
  const debouncedSearch = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (query: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          store.searchMarketplace(query, store.searchTags);
        }, 300);
      };
    })(),
    [],
  );

  const handleSearch = (query: string) => {
    store.setSearchQuery(query);
    if (activeTab === TAB_MARKETPLACE) {
      debouncedSearch(query);
    }
  };

  const handleTagToggle = (tag: string) => {
    const newTags = store.searchTags.includes(tag)
      ? store.searchTags.filter((t) => t !== tag)
      : [...store.searchTags, tag];
    store.setSearchTags(newTags);
    if (activeTab === TAB_MARKETPLACE) {
      store.searchMarketplace(store.searchQuery, newTags);
    }
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === TAB_MARKETPLACE) {
      store.searchMarketplace(store.searchQuery, store.searchTags);
    }
  };

  const handleInstall = async (pluginId: string) => {
    await store.installPlugin(pluginId);
  };

  const handleUninstall = async (pluginId: string) => {
    if (window.confirm('确定要卸载此插件吗？插件数据将被清除。')) {
      await store.uninstallPlugin(pluginId);
    }
  };

  const handleToggle = async (pluginId: string, activate: boolean) => {
    if (activate) {
      await store.activatePlugin(pluginId);
    } else {
      await store.deactivatePlugin(pluginId);
    }
  };

  // ── Installed plugins ───────────────────────────────────────────────
  const installedPlugins = [...store.installed.values()];
  const activeCount = installedPlugins.filter((p) => p.status === 'active').length;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>🧩 插件管理</h2>
        <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
          安装和管理 QUANT MOO 扩展插件 · {activeCount} 个运行中
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e0e0e0' }}>
        {[
          { key: TAB_INSTALLED, label: '已安装', count: installedPlugins.length },
          { key: TAB_MARKETPLACE, label: '插件市场', count: undefined },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #1976d2' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.key ? '#1976d2' : '#666',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ marginLeft: 6, fontSize: 12, color: '#999' }}>({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <SearchBar
        query={store.searchQuery}
        tags={store.searchTags}
        onSearch={handleSearch}
        onTagToggle={handleTagToggle}
        isLoading={store.isLoadingMarketplace}
      />

      {/* Content */}
      {activeTab === TAB_INSTALLED && (
        <>
          {store.isLoadingInstalled && <p style={{ color: '#999', textAlign: 'center' }}>加载中...</p>}
          {!store.isLoadingInstalled && installedPlugins.length === 0 && (
            <EmptyState message="尚未安装任何插件。前往「插件市场」探索可用插件。" />
          )}
          {!store.isLoadingInstalled &&
            installedPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onToggle={handleToggle}
              />
            ))}
        </>
      )}

      {activeTab === TAB_MARKETPLACE && (
        <>
          {store.isLoadingMarketplace && (
            <p style={{ color: '#999', textAlign: 'center' }}>搜索中...</p>
          )}
          {!store.isLoadingMarketplace && store.marketplaceResults.length === 0 && (
            <EmptyState
              message={
                store.searchQuery
                  ? `未找到匹配 "${store.searchQuery}" 的插件`
                  : '输入关键词搜索插件'
              }
            />
          )}
          {!store.isLoadingMarketplace &&
            store.marketplaceResults.map((plugin: PluginInfo) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onToggle={handleToggle}
              />
            ))}
        </>
      )}
    </div>
  );
}
