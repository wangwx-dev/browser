import { useState } from 'react';
import composerize from 'composerize';
import Editor from '@monaco-editor/react';

export default function DockerTools() {
  const [dockerRunCommand, setDockerRunCommand] = useState('docker run -d -p 80:80 -v /var/run/docker.sock:/tmp/docker.sock:ro --restart always --log-opt max-size=1g nginx');
  const [composeYaml, setComposeYaml] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConvert = () => {
    try {
      if (!dockerRunCommand.trim()) return setComposeYaml('');
      const yaml = composerize(dockerRunCommand.trim());
      setComposeYaml(yaml);
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('解析失败，请检查 docker run 命令格式是否正确');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>Docker 命令转换器</h1>
      </div>

      <div style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 200px)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>输入: docker run 命令</h3>
          </div>
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              defaultLanguage="shell"
              theme="vs-dark"
              value={dockerRunCommand}
              onChange={(val) => setDockerRunCommand(val || '')}
              options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', minWidth: '160px' }}>
          <button className="btn" onClick={handleConvert}>转换为 Compose ➔</button>
          {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{errorMsg}</div>}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>输出: docker-compose.yml</h3>
          </div>
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              defaultLanguage="yaml"
              theme="vs-dark"
              value={composeYaml}
              options={{ minimap: { enabled: false }, fontSize: 14, readOnly: true }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
