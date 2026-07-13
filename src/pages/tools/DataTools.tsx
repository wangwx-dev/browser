import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function DataTools() {
  const [uuidCount, setUuidCount] = useState(5);
  const [uuidOutput, setUuidOutput] = useState('');

  const [pwdLength, setPwdLength] = useState(16);
  const [pwdOutput, setPwdOutput] = useState('');

  const handleGenerateUUIDs = () => {
    let count = parseInt(uuidCount as any, 10);
    if (isNaN(count) || count < 1) count = 1;
    if (count > 1000) count = 1000;
    
    const uuids = [];
    for (let i = 0; i < count; i++) {
      uuids.push(uuidv4());
    }
    setUuidOutput(uuids.join('\n'));
  };

  const handleGeneratePassword = () => {
    let len = parseInt(pwdLength as any, 10);
    if (isNaN(len) || len < 4) len = 4;
    if (len > 128) len = 128;

    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let retVal = "";
    for (let i = 0, n = charset.length; i < len; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    setPwdOutput(retVal);
  };

  return (
    <div className="page-container">
      <div className="header">
        <h1>Mock数据 & 随机生成器</h1>
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>UUID / GUID 批量生成器</h2>
          <p>生成指定数量的 UUID v4，最大支持 1000 个。</p>
        </div>
        <div className="input-group">
          <label>生成数量</label>
          <input 
            type="number"
            className="form-control" 
            value={uuidCount}
            onChange={(e) => setUuidCount(parseInt(e.target.value) || 0)}
            min="1"
            max="1000"
          />
        </div>
        <div className="button-group">
          <button className="btn" onClick={handleGenerateUUIDs}>批量生成 UUID</button>
        </div>
        {uuidOutput && <div className="result-box">{uuidOutput}</div>}
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>高强度密码生成器</h2>
          <p>按指定长度生成包含大小写、数字及特殊符号的随机密码</p>
        </div>
        <div className="input-group">
          <label>密码长度</label>
          <input 
            type="number"
            className="form-control" 
            value={pwdLength}
            onChange={(e) => setPwdLength(parseInt(e.target.value) || 0)}
            min="4"
            max="128"
          />
        </div>
        <div className="button-group">
          <button className="btn" onClick={handleGeneratePassword}>生成随机密码</button>
        </div>
        {pwdOutput && (
          <div className="result-box" style={{ fontSize: '1.25rem', letterSpacing: '2px', textAlign: 'center' }}>
            {pwdOutput}
          </div>
        )}
      </div>
    </div>
  );
}
