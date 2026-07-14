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
  Search,
  Globe,
  ShieldAlert,
  Repeat,
  Type,
  Image as ImageIcon
} from 'lucide-react';

const TOOLS_CONFIG = [
  { path: '/', name: '网站导航', icon: Compass, group: '导航' },
  { path: '/tools/network', name: '网络与 IP', icon: Globe, group: '网络工具' },
  
  { path: '/tools/security', name: '证书与 RSA 密钥', icon: ShieldAlert, group: '安全与加解密' },
  { path: '/tools/crypto', name: 'Hash & Bcrypt', icon: Hash, group: '安全与加解密' },
  
  { path: '/tools/converter', name: '全能转换器 (SQL/Base)', icon: Repeat, group: '格式化与转换' },
  { path: '/tools/json', name: 'JSON / YAML 专业版', icon: FileJson, group: '格式化与转换' },
  { path: '/tools/docker', name: 'Docker 到 Compose', icon: Box, group: '格式化与转换' },
  
  { path: '/tools/text', name: '文本手术刀', icon: Type, group: '文本处理' },
  { path: '/tools/diff', name: '代码 Diff 对比', icon: FileJson, group: '文本处理' },
  { path: '/tools/encode', name: 'URL / Base64 / JWT', icon: Code2, group: '文本处理' },
  
  { path: '/tools/time', name: 'Cron & 时间戳', icon: Clock, group: '时间与开发辅助' },
  { path: '/tools/data', name: 'Mock数据 & UUID', icon: Database, group: '时间与开发辅助' },
  { path: '/tools/cheatsheets', name: '命令备忘录', icon: BookOpen, group: '时间与开发辅助' },
  
  { path: '/tools/media', name: '多媒体与二维码', icon: ImageIcon, group: '图像与多媒体' },
];

export const Sidebar: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTools = TOOLS_CONFIG.filter(tool => 
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tool.group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Maintain original order of groups
  const groups = Array.from(new Set(TOOLS_CONFIG.map(t => t.group))).filter(g => filteredTools.some(t => t.group === g));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <TerminalSquare className="w-6 h-6 text-sky-400" />
        <span>DevTools Max</span>
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
