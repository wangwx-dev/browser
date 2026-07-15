import { useState, useMemo, useEffect } from 'react';
import '../App.css';
import { LinkCard } from '../components/LinkCard';
import type { LinkItem } from '../components/LinkCard';
import { SettingsModal } from '../components/SettingsModal';
import { AddLinkModal } from '../components/AddLinkModal';
import { fetchGistData, updateGistData } from '../utils/gistSync';
import type { GistConfig } from '../utils/gistSync';
import { Settings, Edit2, Plus, Trash2, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import initialData from '../data.json';

export default function Navigation() {
  const [navData, setNavData] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeCategoryForNewLink, setActiveCategoryForNewLink] = useState<number | null>(null);
  
  const [gistConfig, setGistConfig] = useState<GistConfig>(() => {
    const saved = localStorage.getItem('gistConfig');
    return saved ? JSON.parse(saved) : { gistId: '', token: '' };
  });
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Load from Gist on mount or config change
  useEffect(() => {
    if (gistConfig.gistId) {
      loadFromCloud();
    }
  }, [gistConfig.gistId]);

  const loadFromCloud = async () => {
    setSyncStatus('syncing');
    try {
      const data = await fetchGistData(gistConfig);
      if (data && Array.isArray(data)) {
        setNavData(data);
        setSyncStatus('success');
      } else {
        setSyncStatus('idle'); // No data yet, maybe new gist
      }
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
    }
  };

  const saveToCloud = async (newData: any) => {
    setNavData(newData);
    if (!gistConfig.gistId || !gistConfig.token) return;
    
    setSyncStatus('syncing');
    try {
      await updateGistData(gistConfig, newData);
      setSyncStatus('success');
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
    }
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return navData;
    
    const query = searchQuery.toLowerCase();
    return navData.map(category => {
      const filteredLinks = category.links.filter(link => 
        link.name.toLowerCase().includes(query) || 
        link.desc.toLowerCase().includes(query)
      );
      return { ...category, links: filteredLinks };
    }).filter(category => category.links.length > 0 || category.category.toLowerCase().includes(query));
  }, [searchQuery, navData]);

  // Handlers for Edit Mode
  const handleDeleteLink = (catIdx: number, linkIdx: number) => {
    if (!window.confirm('确定要删除这个网站吗？')) return;
    const newData = [...navData];
    newData[catIdx].links.splice(linkIdx, 1);
    saveToCloud(newData);
  };

  const handleDeleteCategory = (catIdx: number) => {
    if (!window.confirm('确定要删除整个分类及其下所有网站吗？')) return;
    const newData = [...navData];
    newData.splice(catIdx, 1);
    saveToCloud(newData);
  };

  const handleAddCategory = () => {
    const name = window.prompt('请输入新分类名称:');
    if (name) {
      const newData = [...navData, { category: name, links: [] }];
      saveToCloud(newData);
    }
  };

  const handleAddLink = (link: LinkItem) => {
    if (activeCategoryForNewLink === null) return;
    const newData = [...navData];
    newData[activeCategoryForNewLink].links.push(link);
    saveToCloud(newData);
    setActiveCategoryForNewLink(null);
  };

  return (
    <div className="page-container">
      <header className="header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1>我的导航</h1>
          {gistConfig.gistId ? (
            <div title="云端同步状态" style={{ display: 'flex', alignItems: 'center', color: syncStatus === 'error' ? '#ef4444' : syncStatus === 'syncing' ? '#38bdf8' : '#22c55e' }}>
              {syncStatus === 'syncing' ? <RefreshCw size={18} className="spin" /> : <Cloud size={18} />}
            </div>
          ) : (
            <div title="未配置云同步" style={{ color: '#64748b' }}><CloudOff size={18} /></div>
          )}
        </div>
        
        <div className="search-bar" style={{ margin: '0 auto', flex: 1, minWidth: '200px', maxWidth: '400px' }}>
          <input 
            type="text" 
            placeholder="搜索网站..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn ${isEditing ? '' : 'btn-secondary'}`} 
            onClick={() => setIsEditing(!isEditing)}
            title="进入编辑模式"
          >
            <Edit2 size={16} />
            {isEditing ? '完成' : '编辑'}
          </button>
          <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(true)} title="云端同步设置">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main>
        {filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8' }}>
            <p>没有找到相关内容</p>
          </div>
        ) : (
          filteredData.map((category, catIdx) => (
            <section key={catIdx} className="category-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 className="category-title" style={{ marginBottom: 0 }}>{category.category}</h2>
                {isEditing && (
                  <button onClick={() => handleDeleteCategory(catIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <div className="links-grid">
                {category.links.map((link, linkIdx) => (
                  <LinkCard 
                    key={linkIdx} 
                    link={link} 
                    isEditing={isEditing} 
                    onDelete={() => handleDeleteLink(catIdx, linkIdx)} 
                  />
                ))}
                
                {isEditing && (
                  <button 
                    onClick={() => setActiveCategoryForNewLink(catIdx)}
                    style={{
                      background: 'rgba(255,255,255,0.02)', border: '2px dashed var(--glass-border)',
                      borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer',
                      minHeight: '100px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                  >
                    <Plus size={24} style={{ marginBottom: '0.5rem' }} />
                    <span>添加网站</span>
                  </button>
                )}
              </div>
            </section>
          ))
        )}

        {isEditing && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <button className="btn btn-secondary" onClick={handleAddCategory}>
              <Plus size={16} /> 新增分类
            </button>
          </div>
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={gistConfig}
        onSave={(newConfig) => {
          setGistConfig(newConfig);
          localStorage.setItem('gistConfig', JSON.stringify(newConfig));
          setIsSettingsOpen(false);
        }}
      />

      <AddLinkModal
        isOpen={activeCategoryForNewLink !== null}
        onClose={() => setActiveCategoryForNewLink(null)}
        onSave={handleAddLink}
      />
    </div>
  );
}
