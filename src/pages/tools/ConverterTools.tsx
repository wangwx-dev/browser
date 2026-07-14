import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { format as formatSql } from 'sql-formatter';

export default function ConverterTools() {
  const [baseInput, setBaseInput] = useState('');
  const [currentBase, setCurrentBase] = useState<number>(10);

  const [sqlInput, setSqlInput] = useState('SELECT * FROM users WHERE age > 18 GROUP BY id ORDER BY created_at DESC');
  const [sqlOutput, setSqlOutput] = useState('');
  const [sqlDialect, setSqlDialect] = useState('mysql');
  const [sqlError, setSqlError] = useState('');

  const parseNumber = (val: string, base: number) => {
    if (!val) return null;
    const parsed = parseInt(val, base);
    return isNaN(parsed) ? null : parsed;
  };

  const handleBaseChange = (val: string, base: number) => {
    setCurrentBase(base);
    setBaseInput(val);
  };

  const numValue = parseNumber(baseInput, currentBase);

  const formatSqlCode = () => {
    try {
      if (!sqlInput.trim()) return setSqlOutput('');
      const formatted = formatSql(sqlInput, { language: sqlDialect as any });
      setSqlOutput(formatted);
      setSqlError('');
    } catch (e: any) {
      setSqlError(e.message);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>万能转换器 (Converters)</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Base Converter */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tool-header">
            <h2>进制换算器 (Base Converter)</h2>
            <p>实时双向转换多进制数值</p>
          </div>
          <div className="input-group">
            <label>十进制 (Decimal)</label>
            <input 
              type="text" 
              className="form-control" 
              value={currentBase === 10 ? baseInput : (numValue !== null ? numValue.toString(10) : '')}
              onChange={(e) => handleBaseChange(e.target.value, 10)}
            />
          </div>
          <div className="input-group">
            <label>十六进制 (Hexadecimal)</label>
            <input 
              type="text" 
              className="form-control" 
              value={currentBase === 16 ? baseInput : (numValue !== null ? numValue.toString(16).toUpperCase() : '')}
              onChange={(e) => handleBaseChange(e.target.value, 16)}
            />
          </div>
          <div className="input-group">
            <label>八进制 (Octal)</label>
            <input 
              type="text" 
              className="form-control" 
              value={currentBase === 8 ? baseInput : (numValue !== null ? numValue.toString(8) : '')}
              onChange={(e) => handleBaseChange(e.target.value, 8)}
            />
          </div>
          <div className="input-group">
            <label>二进制 (Binary)</label>
            <input 
              type="text" 
              className="form-control" 
              value={currentBase === 2 ? baseInput : (numValue !== null ? numValue.toString(2) : '')}
              onChange={(e) => handleBaseChange(e.target.value, 2)}
            />
          </div>
        </div>

        {/* SQL Formatter */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
          <div className="tool-header">
            <h2>SQL 排版格式化 (SQL Formatter)</h2>
            <p>一键美化杂乱的 SQL 语句，支持多种方言</p>
          </div>
          
          <div className="input-group" style={{ maxWidth: '200px' }}>
            <label>SQL 方言 (Dialect)</label>
            <select className="form-control" value={sqlDialect} onChange={(e) => setSqlDialect(e.target.value)}>
              <option value="sql">Standard SQL</option>
              <option value="mysql">MySQL</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="tsql">SQL Server</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem', height: '300px', marginTop: '1rem' }}>
            <div style={{ flex: 1, border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme="vs-dark"
                value={sqlInput}
                onChange={(val) => setSqlInput(val || '')}
                options={{ minimap: { enabled: false } }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <button className="btn" onClick={formatSqlCode}>格式化 ➔</button>
            </div>

            <div style={{ flex: 1, border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme="vs-dark"
                value={sqlOutput}
                options={{ minimap: { enabled: false }, readOnly: true }}
              />
            </div>
          </div>
          {sqlError && <div style={{ color: '#ef4444', marginTop: '1rem' }}>{sqlError}</div>}
        </div>

      </div>
    </div>
  );
}
