import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Compass, 
  Code2, 
  FileJson, 
  Clock, 
  BookOpen, 
  TerminalSquare, 
  Database,
  Hash,
  Box,
  Search
} from 'lucide-react';

const TOOLS_CONFIG = [
  { path: '/', name: '网站导航', icon: Compass, group: '导航' },
  { path: '/tools/encode', name: 'URL / Base64 / JWT', icon: Code2, group: '编码与解码' },
  { path: '/tools/json', name: 'JSON / YAML 专业版', icon: FileJson, group: '格式化与转换' },
  { path: '/tools/docker', name: 'Docker 到 Compose', icon: Box, group: '格式化与转换' },
  { path: '/tools/diff', name: '文本 Diff 对比', icon: FileJson, group: '开发辅助' },
  { path: '/tools/time', name: 'Cron & 时间戳', icon: Clock, group: '时间与计划' },
  { path: '/tools/data', name: 'Mock数据 & UUID', icon: Database, group: '开发辅助' },
  { path: '/tools/crypto', name: 'Hash & Crypto', icon: Hash, group: '开发辅助' },
  { path: '/tools/cheatsheets', name: '命令备忘录', icon: BookOpen, group: '开发辅助' },
];

export const Sidebar: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTools = TOOLS_CONFIG.filter(tool => 
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tool.group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groups = Array.from(new Set(filteredTools.map(t => t.group)));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <TerminalSquare className="w-6 h-6 text-sky-400" />
        <span>DevTools Pro</span>
      </div>
      
      <div className="sidebar-search">
        <Search size={16} className="search-icon" />
        <input 
          type="text" 
          placeholder="搜索工具..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <nav className="sidebar-nav">
        {groups.map(group => (
          <div key={group} className="sidebar-group">
            <div className="sidebar-group-title">{group}</div>
            {filteredTools.filter(t => t.group === group).map(tool => (
              <NavLink key={tool.path} to={tool.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end={tool.path === '/'}>
                <tool.icon size={18} />
                <span>{tool.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
        {filteredTools.length === 0 && (
          <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem', textAlign: 'center' }}>
            未找到工具
          </div>
        )}
      </nav>
    </aside>
  );
};
