import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { isSupabaseConfigured } from './lib/supabase';
import './App.css';

function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="page-container" style={{ justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem' }}>
        <div className="tool-card" style={{ maxWidth: '600px', width: '100%' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>配置错误 (Configuration Error)</h2>
          <p>您的 <code>VITE_SUPABASE_URL</code> 配置不正确。系统检测到您的环境变量中可能包含了无效字符（如中括号 `[]`），导致应用崩溃。</p>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
            <p><strong>正确的格式应该是这样的：</strong></p>
            <code style={{ color: '#22c55e' }}>https://abcdefghijklmnop.supabase.co</code>
            <p style={{ marginTop: '1rem' }}><strong>错误的格式：</strong></p>
            <code style={{ color: '#ef4444' }}>https://[YOUR_PROJECT_ID].supabase.co</code>
          </div>
          <p style={{ marginTop: '1.5rem', color: '#94a3b8' }}>
            请前往 Cloudflare Pages 后台的 Environment Variables 页面，将 <code>VITE_SUPABASE_URL</code> 替换为您在 Supabase 真实的 Project URL，然后<strong>重新部署 (Retry Deployment)</strong>。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
