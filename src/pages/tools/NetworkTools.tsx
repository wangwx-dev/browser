import { useState } from 'react';

// Basic CIDR calculation
function calculateSubnet(ip: string, mask: number) {
  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some(isNaN) || mask < 0 || mask > 32) return null;

  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const maskNum = mask === 0 ? 0 : (~0 << (32 - mask));
  
  const networkNum = ipNum & maskNum;
  const broadcastNum = networkNum | ~maskNum;
  
  const numToIp = (num: number) => 
    `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;

  return {
    ip,
    mask: numToIp(maskNum),
    network: numToIp(networkNum),
    broadcast: numToIp(broadcastNum),
    firstHost: mask >= 31 ? 'N/A' : numToIp(networkNum + 1),
    lastHost: mask >= 31 ? 'N/A' : numToIp(broadcastNum - 1),
    totalHosts: mask >= 31 ? 0 : Math.pow(2, 32 - mask) - 2
  };
}

export default function NetworkTools() {
  const [cidrInput, setCidrInput] = useState('192.168.1.10/24');
  const [urlInput, setUrlInput] = useState('https://example.com:8080/path/to/page?user=john&id=123#section1');
  
  const [parsedUrl, setParsedUrl] = useState<URL | null>(null);

  let subnetInfo = null;
  try {
    const [ip, maskStr] = cidrInput.split('/');
    if (ip && maskStr) {
      subnetInfo = calculateSubnet(ip, parseInt(maskStr, 10));
    }
  } catch (e) {}

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>网络与 IP 工具</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* CIDR Calculator */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tool-header">
            <h2>IPv4 子网计算器 (CIDR)</h2>
            <p>输入 IP/掩码位，实时计算网络地址与可用范围</p>
          </div>
          <div className="input-group">
            <input 
              type="text" 
              className="form-control" 
              placeholder="例如: 192.168.1.10/24"
              value={cidrInput}
              onChange={(e) => setCidrInput(e.target.value)}
            />
          </div>
          
          <div className="result-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {subnetInfo ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>IP 地址:</span> <span>{subnetInfo.ip}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>子网掩码:</span> <span>{subnetInfo.mask}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>网络地址:</span> <span>{subnetInfo.network}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>广播地址:</span> <span>{subnetInfo.broadcast}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>可用主机范围:</span> <span>{subnetInfo.firstHost} - {subnetInfo.lastHost}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>可用主机数:</span> <span>{subnetInfo.totalHosts}</span>
                </div>
              </>
            ) : (
              <span style={{ color: '#ef4444' }}>无效的 CIDR 格式</span>
            )}
          </div>
        </div>

        {/* URL Parser */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tool-header">
            <h2>URL 深度解析器</h2>
            <p>将长 URL 拆解为各个组件并解析 Query 参数</p>
          </div>
          <div className="input-group">
            <textarea 
              className="form-control" 
              style={{ height: '80px' }}
              placeholder="输入完整的 URL..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                try { setParsedUrl(new URL(e.target.value)); } catch { setParsedUrl(null); }
              }}
            />
          </div>
          
          <div className="result-box" style={{ flex: 1, marginTop: '1rem', overflowX: 'auto' }}>
            {parsedUrl ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  {[
                    ['协议 (Protocol)', parsedUrl.protocol],
                    ['主机 (Host)', parsedUrl.host],
                    ['端口 (Port)', parsedUrl.port || '(default)'],
                    ['路径 (Path)', parsedUrl.pathname],
                    ['哈希 (Hash)', parsedUrl.hash]
                  ].map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <td style={{ padding: '0.5rem', color: '#94a3b8', width: '120px' }}>{key}</td>
                      <td style={{ padding: '0.5rem', wordBreak: 'break-all' }}>{val}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ padding: '1rem 0.5rem 0.5rem', color: '#38bdf8', fontWeight: 'bold' }}>Query 参数 (Search Params)</td>
                  </tr>
                  {Array.from(parsedUrl.searchParams.entries()).length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ padding: '0.5rem', color: '#94a3b8' }}>无参数</td>
                    </tr>
                  )}
                  {Array.from(parsedUrl.searchParams.entries()).map(([k, v], idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>{k}</td>
                      <td style={{ padding: '0.5rem', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span style={{ color: '#ef4444' }}>无效的 URL</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
