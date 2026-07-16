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

  const [isFetching, setIsFetching] = useState(false);

  if (!isOpen) return null;

  const fetchMetadata = async () => {
    if (!url) return;
    
    // 自动补全 http
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
      setUrl(targetUrl);
    }

    setIsFetching(true);
    try {
      // 使用免费开源的 microlink API 提取网页元数据
      const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(targetUrl)}`);
      const json = await res.json();
      if (json.status === 'success') {
        const data = json.data;
        if (data.title) setName(data.title);
        if (data.description) setDesc(data.description);
        if (data.logo?.url) {
          setIcon(data.logo.url);
        } else {
          // 如果没有解析到logo，尝试使用谷歌的 favicon 接口
          setIcon(`https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(targetUrl)}`);
        }
      }
    } catch (error) {
      console.error("解析 URL 失败:", error);
    } finally {
      setIsFetching(false);
    }
  };

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
          <label>URL (网址)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              className="form-control" 
              style={{ flex: 1 }}
              placeholder="https://..." 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              onBlur={fetchMetadata}
              onKeyDown={(e) => e.key === 'Enter' && fetchMetadata()}
            />
            <button 
              className="btn btn-secondary" 
              onClick={fetchMetadata} 
              disabled={isFetching || !url}
              style={{ whiteSpace: 'nowrap', padding: '0 1rem' }}
            >
              {isFetching ? '解析中...' : '自动识别'}
            </button>
          </div>
          <small style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>输入网址后失去焦点或点击"自动识别"，可一键提取网站信息</small>
        </div>

        <div className="input-group">
          <label>网站名称</label>
          <input className="form-control" placeholder="例如: GitHub" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        
        <div className="input-group">
          <label>描述信息</label>
          <input className="form-control" placeholder="一句话描述..." value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="input-group">
          <label>图标 URL (可选)</label>
          <input className="form-control" placeholder="留空则自动生成文字图标" value={icon} onChange={(e) => setIcon(e.target.value)} />
          {icon && (
            <div style={{ marginTop: '8px', padding: '8px', background: 'var(--glass-bg)', borderRadius: '8px', display: 'inline-block' }}>
              <img src={icon} alt="icon preview" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
            </div>
          )}
        </div>

        <div className="button-group" style={{ marginBottom: 0, justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn" onClick={handleSubmit} disabled={!name || !url}>保存</button>
        </div>
      </div>
    </div>
  );
};
