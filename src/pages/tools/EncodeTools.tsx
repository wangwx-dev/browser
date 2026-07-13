import { useState } from 'react';
import { jwtDecode } from 'jwt-decode';

export default function EncodeTools() {
  const [urlInput, setUrlInput] = useState('');
  const [urlOutput, setUrlOutput] = useState('');
  
  const [base64Input, setBase64Input] = useState('');
  const [base64Output, setBase64Output] = useState('');

  const [jwtInput, setJwtInput] = useState('');
  const [jwtOutput, setJwtOutput] = useState('');

  const handleUrlEncode = () => {
    try { setUrlOutput(encodeURIComponent(urlInput)); } catch (e) { setUrlOutput('Error formatting'); }
  };
  const handleUrlDecode = () => {
    try { setUrlOutput(decodeURIComponent(urlInput)); } catch (e) { setUrlOutput('Error decoding'); }
  };

  const handleBase64Encode = () => {
    try { setBase64Output(btoa(unescape(encodeURIComponent(base64Input)))); } catch (e) { setBase64Output('Error formatting'); }
  };
  const handleBase64Decode = () => {
    try { setBase64Output(decodeURIComponent(escape(atob(base64Input)))); } catch (e) { setBase64Output('Error decoding'); }
  };

  const handleJwtDecode = () => {
    try {
      if (!jwtInput.trim()) return setJwtOutput('');
      const decodedHeader = jwtDecode(jwtInput, { header: true });
      const decodedPayload = jwtDecode(jwtInput);
      setJwtOutput(JSON.stringify({ header: decodedHeader, payload: decodedPayload }, null, 2));
    } catch (e: any) {
      setJwtOutput('Invalid JWT Token: ' + e.message);
    }
  };

  return (
    <div className="page-container">
      <div className="header">
        <h1>编码与解码工具</h1>
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>URL Encode / Decode</h2>
          <p>对 URL 及其参数进行安全编码和解码</p>
        </div>
        <div className="input-group">
          <textarea 
            className="form-control" 
            placeholder="输入原文本或需要 Decode 的内容..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
        </div>
        <div className="button-group">
          <button className="btn" onClick={handleUrlEncode}>Encode 编码</button>
          <button className="btn btn-secondary" onClick={handleUrlDecode}>Decode 解码</button>
        </div>
        {urlOutput && <div className="result-box">{urlOutput}</div>}
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>Base64 转换</h2>
          <p>字符串与 Base64 格式双向转换 (支持中文)</p>
        </div>
        <div className="input-group">
          <textarea 
            className="form-control" 
            placeholder="输入原文本或需要 Decode 的内容..."
            value={base64Input}
            onChange={(e) => setBase64Input(e.target.value)}
          />
        </div>
        <div className="button-group">
          <button className="btn" onClick={handleBase64Encode}>Encode 编码</button>
          <button className="btn btn-secondary" onClick={handleBase64Decode}>Decode 解码</button>
        </div>
        {base64Output && <div className="result-box">{base64Output}</div>}
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>JWT (JSON Web Token) 解析</h2>
          <p>本地解析 JWT Token 提取 Header 和 Payload 信息，安全可靠不走网络传输。</p>
        </div>
        <div className="input-group">
          <textarea 
            className="form-control" 
            placeholder="粘贴 eyJhbG... 格式的 JWT 字符串"
            value={jwtInput}
            onChange={(e) => {
              setJwtInput(e.target.value);
            }}
          />
        </div>
        <div className="button-group">
          <button className="btn" onClick={handleJwtDecode}>解析 Token</button>
        </div>
        {jwtOutput && <div className="result-box">{jwtOutput}</div>}
      </div>
    </div>
  );
}
