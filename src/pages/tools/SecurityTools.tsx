import { useState } from 'react';
import forge from 'node-forge';
import CryptoJS from 'crypto-js';

export default function SecurityTools() {
  const [rsaKeys, setRsaKeys] = useState<{ public: string, private: string } | null>(null);
  const [rsaBits, setRsaBits] = useState<number>(2048);
  const [isGenerating, setIsGenerating] = useState(false);

  const [certInput, setCertInput] = useState('');
  const [certOutput, setCertOutput] = useState<any>(null);
  const [certError, setCertError] = useState('');

  const [hmacText, setHmacText] = useState('');
  const [hmacKey, setHmacKey] = useState('');
  const [hmacOutput, setHmacOutput] = useState<string>('');

  const handleGenerateRSA = () => {
    setIsGenerating(true);
    // setTimeout to allow UI update before blocking generation
    setTimeout(() => {
      try {
        const keypair = forge.pki.rsa.generateKeyPair({ bits: rsaBits, e: 0x10001 });
        setRsaKeys({
          public: forge.pki.publicKeyToPem(keypair.publicKey),
          private: forge.pki.privateKeyToPem(keypair.privateKey)
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsGenerating(false);
      }
    }, 10);
  };

  const handleParseCert = () => {
    try {
      if (!certInput.trim()) return setCertOutput(null);
      const cert = forge.pki.certificateFromPem(certInput);
      setCertOutput({
        subject: cert.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', '),
        issuer: cert.issuer.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', '),
        validFrom: cert.validity.notBefore.toString(),
        validTo: cert.validity.notAfter.toString(),
        serialNumber: cert.serialNumber,
        signatureOid: cert.signatureOid
      });
      setCertError('');
    } catch (e: any) {
      setCertOutput(null);
      setCertError('解析失败，请确保格式是有效的 PEM');
    }
  };

  const handleHmac = () => {
    if (!hmacText || !hmacKey) return setHmacOutput('');
    const hash = CryptoJS.HmacSHA256(hmacText, hmacKey).toString(CryptoJS.enc.Hex);
    setHmacOutput(hash);
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>安全与密钥工具 (Security & Crypto)</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* RSA Generator */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tool-header">
            <h2>RSA 密钥对生成器</h2>
            <p>在本地生成安全可靠的公私钥对 (PEM 格式)</p>
          </div>
          <div className="input-group">
            <label>密钥长度 (Bits)</label>
            <select className="form-control" value={rsaBits} onChange={(e) => setRsaBits(Number(e.target.value))}>
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
            </select>
          </div>
          <div className="button-group">
            <button className="btn" onClick={handleGenerateRSA} disabled={isGenerating}>
              {isGenerating ? '生成中...' : '生成 RSA 密钥对'}
            </button>
          </div>
          {rsaKeys && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>Public Key</label>
                <textarea className="form-control result-box" readOnly value={rsaKeys.public} style={{ height: '120px', fontSize: '0.75rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>Private Key</label>
                <textarea className="form-control result-box" readOnly value={rsaKeys.private} style={{ height: '180px', fontSize: '0.75rem' }} />
              </div>
            </div>
          )}
        </div>

        {/* X.509 Decoder */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tool-header">
            <h2>X.509 证书解析</h2>
            <p>解析 PEM 格式的证书，查看有效期与颁发者</p>
          </div>
          <div className="input-group">
            <textarea 
              className="form-control" 
              style={{ height: '120px', fontSize: '0.75rem' }}
              placeholder="-----BEGIN CERTIFICATE-----..."
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
            />
          </div>
          <div className="button-group">
            <button className="btn" onClick={handleParseCert}>解析证书</button>
          </div>
          {certError && <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>{certError}</div>}
          
          {certOutput && (
            <div className="result-box" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div><strong>主体 (Subject):</strong> <br/><span style={{ color: '#94a3b8' }}>{certOutput.subject}</span></div>
              <div><strong>颁发者 (Issuer):</strong> <br/><span style={{ color: '#94a3b8' }}>{certOutput.issuer}</span></div>
              <div><strong>有效期起:</strong> <br/><span style={{ color: '#94a3b8' }}>{certOutput.validFrom}</span></div>
              <div><strong>有效期止:</strong> <br/><span style={{ color: '#94a3b8' }}>{certOutput.validTo}</span></div>
              <div><strong>序列号 (Serial):</strong> <br/><span style={{ color: '#94a3b8' }}>{certOutput.serialNumber}</span></div>
              <div><strong>签名算法:</strong> <br/><span style={{ color: '#94a3b8' }}>{certOutput.signatureOid}</span></div>
            </div>
          )}
        </div>

        {/* HMAC */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
          <div className="tool-header">
            <h2>HMAC-SHA256 生成器</h2>
            <p>基于 Secret Key 对文本进行 HMAC 签名</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <div className="input-group">
                <label>文本 (Text)</label>
                <textarea 
                  className="form-control" 
                  value={hmacText}
                  onChange={(e) => { setHmacText(e.target.value); }}
                />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <div className="input-group">
                <label>密钥 (Secret Key)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={hmacKey}
                  onChange={(e) => { setHmacKey(e.target.value); }}
                />
              </div>
              <div className="button-group" style={{ marginTop: '1rem' }}>
                <button className="btn" onClick={handleHmac}>生成 HMAC</button>
              </div>
              {hmacOutput && <div className="result-box">{hmacOutput}</div>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
