import { useState, useMemo } from 'react';
import { Search, Copy, Check, Terminal } from 'lucide-react';
import { CHEATSHEETS_DATA } from '../../data/cheatsheets';

export default function Cheatsheets() {
  const [activeTab, setActiveTab] = useState(CHEATSHEETS_DATA[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const activeSheet = CHEATSHEETS_DATA.find(s => s.id === activeTab) || CHEATSHEETS_DATA[0];

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return activeSheet.categories;
    const query = searchQuery.toLowerCase();
    
    return activeSheet.categories.map(cat => ({
      ...cat,
      items: cat.items.filter(item => 
        item.cmd.toLowerCase().includes(query) || 
        item.desc.toLowerCase().includes(query)
      )
    })).filter(cat => cat.items.length > 0);
  }, [searchQuery, activeSheet]);

  const handleCopy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1200px' }}>
      <div className="header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>命令速查备忘录 (Cheatsheets)</h1>
          <div className="search-bar" style={{ margin: 0, maxWidth: '300px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              type="text" 
              placeholder="搜索命令或描述..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
        
        <div className="button-group" style={{ margin: 0, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '0.5rem' }}>
          {CHEATSHEETS_DATA.map(sheet => (
            <button 
              key={sheet.id} 
              className={`btn ${activeTab === sheet.id ? '' : 'btn-secondary'}`} 
              onClick={() => {
                setActiveTab(sheet.id);
                setSearchQuery('');
              }}
              style={{ flexShrink: 0 }}
            >
              <Terminal size={16} />
              {sheet.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b', background: 'var(--glass-bg)', borderRadius: '16px' }}>
            没有找到相关的命令
          </div>
        ) : (
          filteredCategories.map((category, idx) => (
            <div key={idx} className="tool-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                <h2 style={{ fontSize: '1.125rem', color: 'var(--primary-color)', margin: 0 }}>{category.title}</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {category.items.map((item, itemIdx) => (
                  <div 
                    key={itemIdx} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '1rem 1.5rem', 
                      borderBottom: itemIdx === category.items.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                      gap: '1rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: '0 0 300px', display: 'flex', alignItems: 'center' }}>
                      <code style={{ 
                        color: '#38bdf8', 
                        background: 'rgba(56,189,248,0.1)', 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px',
                        fontFamily: 'Fira Code, monospace',
                        fontSize: '0.875rem',
                        wordBreak: 'break-all'
                      }}>
                        {item.cmd}
                      </code>
                      <button 
                        onClick={() => handleCopy(item.cmd)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: copiedCmd === item.cmd ? '#22c55e' : '#64748b', 
                          cursor: 'pointer',
                          marginLeft: '0.5rem',
                          padding: '0.25rem'
                        }}
                        title="复制命令"
                      >
                        {copiedCmd === item.cmd ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <div style={{ flex: 1, color: '#cbd5e1', fontSize: '0.9rem' }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
