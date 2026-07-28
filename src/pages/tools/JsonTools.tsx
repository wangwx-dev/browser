import { useState } from 'react';
import { CodeEditor } from '../../components/tools/CodeEditor';
import yaml from 'yaml';
import JsonToTS from 'json-to-ts';
import { JSONPath } from 'jsonpath-plus';

export default function JsonTools() {
  const [inputContent, setInputContent] = useState('{\n  "hello": "world"\n}');
  const [outputContent, setOutputContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [jsonPathQuery, setJsonPathQuery] = useState('$.hello');

  const formatJson = () => {
    try {
      const val = inputContent;
      const parsed = JSON.parse(val);
      setOutputContent(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const jsonToYaml = () => {
    try {
      const val = inputContent;
      const parsed = JSON.parse(val);
      setOutputContent(yaml.stringify(parsed));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const yamlToJson = () => {
    try {
      const val = inputContent;
      const parsed = yaml.parse(val);
      setOutputContent(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid YAML: ' + e.message);
    }
  };

  const generateTsInterface = () => {
    try {
      const val = inputContent;
      const parsed = JSON.parse(val);
      const interfaces = JsonToTS(parsed).join('\n\n');
      setOutputContent(interfaces);
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const executeJsonPath = () => {
    try {
      const val = inputContent;
      const parsed = JSON.parse(val);
      const result = JSONPath({ path: jsonPathQuery, json: parsed });
      setOutputContent(JSON.stringify(result, null, 2));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('JSONPath Error: ' + e.message);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>JSON / YAML 专业工具</h1>
      </div>

      <div className="code-tool-comparison">
        {/* Left pane: Input */}
        <div className="code-tool-panel">
          <div className="code-tool-panel-header">
            <h2>输入 (JSON / YAML)</h2>
          </div>
          <div className="code-tool-editor">
            <CodeEditor
              ariaLabel="JSON 或 YAML 输入"
              language="json / yaml"
              value={inputContent}
              onChange={setInputContent}
            />
          </div>
        </div>

        {/* Center pane: Actions */}
        <div className="code-tool-actions code-tool-actions-stacked">
          <button className="btn" onClick={formatJson}>JSON 格式化 ➔</button>
          <button className="btn" onClick={jsonToYaml}>JSON 转 YAML ➔</button>
          <button className="btn" onClick={yamlToJson}>YAML 转 JSON ➔</button>
          <button className="btn btn-secondary" onClick={generateTsInterface}>生成 TS 接口 ➔</button>
          
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'block' }}>JSON Path 查询</label>
            <input 
              type="text" 
              className="form-control" 
              value={jsonPathQuery}
              onChange={(e) => setJsonPathQuery(e.target.value)}
              placeholder="$.store.book[*].author"
              style={{ marginBottom: '0.5rem' }}
            />
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={executeJsonPath}>执行查询 ➔</button>
          </div>
          
          {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{errorMsg}</div>}
        </div>

        {/* Right pane: Output */}
        <div className="code-tool-panel">
          <div className="code-tool-panel-header">
            <h2>输出结果</h2>
          </div>
          <div className="code-tool-editor">
            <CodeEditor
              ariaLabel="转换结果"
              language="result"
              value={outputContent}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}
