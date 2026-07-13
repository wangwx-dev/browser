import { useState } from 'react';
import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';

export default function CryptoTools() {
  const [textInput, setTextInput] = useState('');
  const [hashOutput, setHashOutput] = useState<{ md5: string, sha1: string, sha256: string } | null>(null);

  const [bcryptInput, setBcryptInput] = useState('');
  const [bcryptOutput, setBcryptOutput] = useState('');

  const [bcryptHashToVerify, setBcryptHashToVerify] = useState('');
  const [bcryptVerifyResult, setBcryptVerifyResult] = useState<boolean | null>(null);

  const handleGenerateHashes = () => {
    if (!textInput) return setHashOutput(null);
    setHashOutput({
      md5: CryptoJS.MD5(textInput).toString(),
      sha1: CryptoJS.SHA1(textInput).toString(),
      sha256: CryptoJS.SHA256(textInput).toString()
    });
  };

  const handleBcryptGenerate = () => {
    if (!bcryptInput) return;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(bcryptInput, salt);
    setBcryptOutput(hash);
  };

  const handleBcryptVerify = () => {
    if (!bcryptInput || !bcryptHashToVerify) return;
    try {
      const isValid = bcrypt.compareSync(bcryptInput, bcryptHashToVerify);
      setBcryptVerifyResult(isValid);
    } catch (e) {
      setBcryptVerifyResult(false);
    }
  };

  return (
    <div className="page-container">
      <div className="header">
        <h1>Hash & Crypto 工具</h1>
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>常见 Hash 计算 (MD5, SHA)</h2>
          <p>在本地计算文本的哈希值，数据不离开浏览器。</p>
        </div>
        <div className="input-group">
          <textarea 
            className="form-control" 
            placeholder="输入明文文本..."
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              if (e.target.value === '') setHashOutput(null);
            }}
          />
        </div>
        <div className="button-group">
          <button className="btn" onClick={handleGenerateHashes}>计算 Hash</button>
        </div>
        
        {hashOutput && (
          <div className="result-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div><strong>MD5:</strong> {hashOutput.md5}</div>
            <div><strong>SHA-1:</strong> {hashOutput.sha1}</div>
            <div><strong>SHA-256:</strong> {hashOutput.sha256}</div>
          </div>
        )}
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>Bcrypt 生成与验证</h2>
          <p>生成 Bcrypt 密文或验证明文是否匹配给定密文</p>
        </div>
        <div className="input-group">
          <label>明文密码</label>
          <input 
            type="text"
            className="form-control" 
            placeholder="输入明文..."
            value={bcryptInput}
            onChange={(e) => setBcryptInput(e.target.value)}
          />
        </div>
        
        <div className="button-group">
          <button className="btn" onClick={handleBcryptGenerate}>生成 Bcrypt (Rounds=10)</button>
        </div>
        {bcryptOutput && <div className="result-box" style={{ marginBottom: '1.5rem' }}>{bcryptOutput}</div>}

        <div className="input-group" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <label>验证密文</label>
          <input 
            type="text"
            className="form-control" 
            placeholder="粘贴 Bcrypt Hash 如 $2a$10$..."
            value={bcryptHashToVerify}
            onChange={(e) => setBcryptHashToVerify(e.target.value)}
          />
        </div>
        <div className="button-group">
          <button className="btn btn-secondary" onClick={handleBcryptVerify}>验证匹配</button>
        </div>
        {bcryptVerifyResult !== null && (
          <div className="result-box" style={{ 
            color: bcryptVerifyResult ? '#4ade80' : '#ef4444', 
            fontWeight: 'bold',
            fontSize: '1.125rem'
          }}>
            {bcryptVerifyResult ? '✅ 验证成功 (匹配)' : '❌ 验证失败 (不匹配)'}
          </div>
        )}
      </div>
    </div>
  );
}
