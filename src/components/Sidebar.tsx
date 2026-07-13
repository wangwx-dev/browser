import React from 'react';
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
  Palette
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <TerminalSquare className="w-6 h-6 text-sky-400" />
        <span>Dev Portal</span>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <Compass size={18} />
          <span>网站导航</span>
        </NavLink>

        <div className="sidebar-group">
          <div className="sidebar-group-title">编码与解码</div>
          <NavLink to="/tools/encode" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Code2 size={18} />
            <span>URL / Base64 / JWT</span>
          </NavLink>
        </div>

        <div className="sidebar-group">
          <div className="sidebar-group-title">格式化与转换</div>
          <NavLink to="/tools/json" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileJson size={18} />
            <span>JSON / YAML 工具</span>
          </NavLink>
        </div>

        <div className="sidebar-group">
          <div className="sidebar-group-title">时间与计划</div>
          <NavLink to="/tools/time" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Clock size={18} />
            <span>Cron & 时间戳</span>
          </NavLink>
        </div>

        <div className="sidebar-group">
          <div className="sidebar-group-title">开发辅助</div>
          <NavLink to="/tools/data" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Database size={18} />
            <span>Mock数据 & UUID</span>
          </NavLink>
          <NavLink to="/tools/crypto" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Hash size={18} />
            <span>Hash & Crypto</span>
          </NavLink>
          <NavLink to="/tools/cheatsheets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen size={18} />
            <span>命令备忘录</span>
          </NavLink>
        </div>

        <div className="sidebar-group">
          <div className="sidebar-group-title">前端与 UI</div>
          <NavLink to="/tools/css" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Palette size={18} />
            <span>CSS 生成器</span>
          </NavLink>
        </div>
      </nav>
    </aside>
  );
};
