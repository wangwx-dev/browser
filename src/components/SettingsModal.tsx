import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { GistConfig } from '../utils/gistSync';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GistConfig;
  onSave: (config: GistConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [gistId, setGistId] = useState(config.gistId);
  const [token, setToken] = useState(config.token);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div className="tool-card" style={{ width: '400px', maxWidth: '90%', position: 'relative' }}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-color)' }}>云端同步设置</h2>
        
        <div className="input-group">
          <label>GitHub Gist ID</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="例如: 8a9b0c..."
            value={gistId}
            onChange={(e) => setGistId(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>GitHub Personal Access Token (可选)</label>
          <input 
            type="password" 
            className="form-control" 
            placeholder="需具备 gist 权限 (用于保存修改)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            仅本地保存。若只需只读同步，无需填写 Token。
          </small>
        </div>

        <div className="button-group" style={{ marginBottom: 0, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn" onClick={() => onSave({ gistId, token })}>保存设置</button>
        </div>
      </div>
    </div>
  );
};
