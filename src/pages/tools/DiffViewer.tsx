import { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';

export default function DiffViewer() {
  const [original, setOriginal] = useState('这是原始文本。\n修改或者删除这些内容来查看高亮变化。');
  const [modified, setModified] = useState('这是修改后的文本。\n修改或者删除这些内容来查看高亮变化。\n新增加的一行！');

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>文本 / 代码 Diff 对比</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 160px)' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'block' }}>原始文本 (Original)</label>
            <textarea 
              className="form-control" 
              style={{ height: '100px' }}
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'block' }}>修改文本 (Modified)</label>
            <textarea 
              className="form-control" 
              style={{ height: '100px' }}
              value={modified}
              onChange={(e) => setModified(e.target.value)}
            />
          </div>
        </div>

        <div style={{ flex: 1, background: 'var(--glass-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: 0, fontSize: '0.875rem' }}>专业对比视图 (Monaco Diff Editor)</h3>
          </div>
          <div style={{ height: 'calc(100% - 45px)' }}>
            <DiffEditor
              height="100%"
              theme="vs-dark"
              original={original}
              modified={modified}
              options={{
                renderSideBySide: true,
                minimap: { enabled: false },
                fontSize: 14,
                readOnly: true
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
