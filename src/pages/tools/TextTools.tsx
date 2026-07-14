import { useState } from 'react';

export default function TextTools() {
  const [textInput, setTextInput] = useState('hello world\nthis is a test\nhello world\n   \napple\nbanana');
  
  // Case converter
  const toCamel = (s: string) => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
  const toSnake = (s: string) => s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  const toKebab = (s: string) => s.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

  const handleCase = (type: string) => {
    let result = textInput;
    if (type === 'upper') result = textInput.toUpperCase();
    if (type === 'lower') result = textInput.toLowerCase();
    if (type === 'camel') result = textInput.split('\n').map(toCamel).join('\n');
    if (type === 'snake') result = textInput.split('\n').map(toSnake).join('\n');
    if (type === 'kebab') result = textInput.split('\n').map(toKebab).join('\n');
    setTextInput(result);
  };

  // Text Filter
  const handleFilter = (type: string) => {
    let lines = textInput.split('\n');
    if (type === 'sort_az') lines.sort();
    if (type === 'sort_za') lines.sort().reverse();
    if (type === 'sort_len') lines.sort((a, b) => a.length - b.length);
    if (type === 'dedup') lines = Array.from(new Set(lines));
    if (type === 'rm_empty') lines = lines.filter(l => l.trim().length > 0);
    setTextInput(lines.join('\n'));
  };

  // Text Inspector
  const chars = textInput.length;
  const words = textInput.trim().split(/\s+/).filter(w => w.length > 0).length;
  const lines = textInput.split('\n').length;
  const bytes = new Blob([textInput]).size;

  // Lorem Ipsum
  const generateLorem = () => {
    const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
    setTextInput(lorem);
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>文本处理工具 (Text Operations)</h1>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Main Editor */}
        <div style={{ flex: '2', minWidth: '400px', display: 'flex', flexDirection: 'column' }}>
          <div className="tool-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="tool-header">
              <h2>主文本工作区</h2>
            </div>
            <textarea 
              className="form-control" 
              style={{ flex: 1, minHeight: '400px', fontSize: '1rem', lineHeight: '1.5' }}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="tool-card">
            <div className="tool-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem' }}>
              <h3>统计检视器 (Inspector)</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div><span style={{ color: '#94a3b8' }}>字符数:</span> <strong style={{ color: '#38bdf8' }}>{chars}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>单词数:</span> <strong style={{ color: '#38bdf8' }}>{words}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>行数:</span> <strong style={{ color: '#38bdf8' }}>{lines}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>字节大小:</span> <strong style={{ color: '#38bdf8' }}>{bytes} B</strong></div>
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem' }}>
              <h3>大小写转换 (Case)</h3>
            </div>
            <div className="button-group" style={{ marginBottom: 0 }}>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleCase('upper')}>UPPERCASE</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleCase('lower')}>lowercase</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleCase('camel')}>camelCase</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleCase('snake')}>snake_case</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleCase('kebab')}>kebab-case</button>
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem' }}>
              <h3>多行过滤与排序 (Sort & Filter)</h3>
            </div>
            <div className="button-group" style={{ marginBottom: 0 }}>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleFilter('sort_az')}>A-Z 排序</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleFilter('sort_za')}>Z-A 排序</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleFilter('sort_len')}>按长度排序</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleFilter('dedup')}>去重重复行</button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleFilter('rm_empty')}>去除空白行</button>
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-header" style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem' }}>
              <h3>生成器 (Generators)</h3>
            </div>
            <div className="button-group" style={{ marginBottom: 0 }}>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={generateLorem}>生成 Lorem Ipsum</button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
