import { useState } from 'react';
import yaml from 'yaml';

export default function JsonTools() {
  const [jsonInput, setJsonInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonOutput(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const minifyJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonOutput(JSON.stringify(parsed));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const jsonToYaml = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonOutput(yaml.stringify(parsed));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const yamlToJson = () => {
    try {
      const parsed = yaml.parse(jsonInput);
      setJsonOutput(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid YAML: ' + e.message);
    }
  };

  return (
    <div className="page-container">
      <div className="header">
        <h1>JSON & YAML 工具</h1>
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>JSON / YAML 转换与格式化</h2>
          <p>粘贴您的 JSON 或 YAML，使用下方按钮进行处理</p>
        </div>
        <div className="input-group">
          <textarea 
            className="form-control" 
            style={{ height: '200px' }}
            placeholder="粘贴 JSON 或 YAML 代码..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
        </div>
        
        {errorMsg && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>{errorMsg}</div>}

        <div className="button-group">
          <button className="btn" onClick={formatJson}>格式化 JSON</button>
          <button className="btn btn-secondary" onClick={minifyJson}>压缩 JSON</button>
          <button className="btn btn-secondary" onClick={jsonToYaml}>JSON ➔ YAML</button>
          <button className="btn btn-secondary" onClick={yamlToJson}>YAML ➔ JSON</button>
        </div>

        {jsonOutput && (
          <div className="result-box" style={{ maxHeight: '600px' }}>
            {jsonOutput}
          </div>
        )}
      </div>
    </div>
  );
}
