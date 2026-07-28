import { useState } from 'react';
import composerize from 'composerize';
import { CodeEditor } from '../../components/tools/CodeEditor';

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
    } catch {
      setErrorMsg('解析失败，请检查 docker run 命令格式是否正确');
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>Docker 命令转换器</h1>
      </div>

      <div className="code-tool-comparison">
        <div className="code-tool-panel">
          <div className="code-tool-panel-header">
            <h2>输入: docker run 命令</h2>
          </div>
          <div className="code-tool-editor">
            <CodeEditor
              ariaLabel="docker run 命令"
              language="shell"
              value={dockerRunCommand}
              onChange={setDockerRunCommand}
            />
          </div>
        </div>

        <div className="code-tool-actions code-tool-actions-stacked">
          <button className="btn" onClick={handleConvert}>转换为 Compose ➔</button>
          {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{errorMsg}</div>}
        </div>

        <div className="code-tool-panel">
          <div className="code-tool-panel-header">
            <h2>输出: docker-compose.yml</h2>
          </div>
          <div className="code-tool-editor">
            <CodeEditor
              ariaLabel="Docker Compose 输出"
              language="yaml"
              value={composeYaml}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}
