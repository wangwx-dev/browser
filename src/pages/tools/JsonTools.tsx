import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import yaml from 'yaml';
import JsonToTS from 'json-to-ts';
import { JSONPath } from 'jsonpath-plus';

export default function JsonTools() {
  const [inputContent, setInputContent] = useState('{\n  "hello": "world"\n}');
  const [outputContent, setOutputContent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [jsonPathQuery, setJsonPathQuery] = useState('$.hello');

  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const getInputValue = () => {
    return editorRef.current ? editorRef.current.getValue() : inputContent;
  };

  const formatJson = () => {
    try {
      const val = getInputValue();
      const parsed = JSON.parse(val);
      setOutputContent(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const jsonToYaml = () => {
    try {
      const val = getInputValue();
      const parsed = JSON.parse(val);
      setOutputContent(yaml.stringify(parsed));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid JSON: ' + e.message);
    }
  };

  const yamlToJson = () => {
    try {
      const val = getInputValue();
      const parsed = yaml.parse(val);
      setOutputContent(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Invalid YAML: ' + e.message);
    }
  };

  const generateTsInterface = () => {
    try {
      const val = getInputValue();
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
      const val = getInputValue();
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

      <div style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 200px)' }}>
        {/* Left pane: Input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>输入 (JSON / YAML)</h3>
          </div>
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              defaultLanguage="json"
              theme="vs-dark"
              value={inputContent}
              onChange={(val) => setInputContent(val || '')}
              onMount={handleEditorDidMount}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Center pane: Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center', minWidth: '160px' }}>
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>输出结果</h3>
          </div>
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={outputContent}
              options={{ minimap: { enabled: false }, fontSize: 14, readOnly: true }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
