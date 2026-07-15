import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { LinkItem } from './LinkCard';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: LinkItem) => void;
}

export const AddLinkModal: React.FC<AddLinkModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name || !url) return;
    onSave({ name, url, desc, icon });
    setName(''); setUrl(''); setDesc(''); setIcon('');
  };

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
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-color)' }}>新增导航链接</h2>
        
        <div className="input-group">
          <label>网站名称</label>
          <input className="form-control" placeholder="例如: GitHub" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="input-group">
          <label>URL (网址)</label>
          <input className="form-control" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="input-group">
          <label>描述信息</label>
          <input className="form-control" placeholder="一句话描述..." value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="input-group">
          <label>图标 URL (可选)</label>
          <input className="form-control" placeholder="留空则自动生成文字图标" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </div>

        <div className="button-group" style={{ marginBottom: 0, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn" onClick={handleSubmit} disabled={!name || !url}>保存</button>
        </div>
      </div>
    </div>
  );
};
