import { useState, useEffect } from 'react';
import cronstrue from 'cronstrue/i18n';

export default function TimeTools() {
  const [cronInput, setCronInput] = useState('* * * * *');
  const [cronOutput, setCronOutput] = useState('');
  
  const [timestampInput, setTimestampInput] = useState('');
  const [timestampOutput, setTimestampOutput] = useState('');

  useEffect(() => {
    try {
      if (cronInput.trim()) {
        const text = cronstrue.toString(cronInput, { locale: 'zh_CN' });
        setCronOutput(text);
      } else {
        setCronOutput('');
      }
    } catch (e: any) {
      setCronOutput('无效的 Cron 表达式: ' + e.toString());
    }
  }, [cronInput]);

  const handleTimestampConvert = () => {
    try {
      if (!timestampInput.trim()) return setTimestampOutput('');
      let ts = parseInt(timestampInput.trim(), 10);
      if (isNaN(ts)) {
        setTimestampOutput('无效的时间戳');
        return;
      }
      // auto detect if seconds or milliseconds
      if (timestampInput.length <= 10) {
        ts *= 1000;
      }
      const date = new Date(ts);
      setTimestampOutput(
        `本地时间: ${date.toLocaleString()}\nISO 8601: ${date.toISOString()}\nUTC: ${date.toUTCString()}`
      );
    } catch (e) {
      setTimestampOutput('转换错误');
    }
  };

  const handleCurrentTime = () => {
    setTimestampInput(Date.now().toString());
  };

  return (
    <div className="page-container">
      <div className="header">
        <h1>时间与计划工具</h1>
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>Unix 时间戳转换</h2>
          <p>将秒级或毫秒级时间戳转换为人类可读的时间格式</p>
        </div>
        <div className="input-group">
          <input 
            type="text"
            className="form-control" 
            placeholder="输入时间戳，例如 1718000000"
            value={timestampInput}
            onChange={(e) => setTimestampInput(e.target.value)}
          />
        </div>
        <div className="button-group">
          <button className="btn" onClick={handleTimestampConvert}>转换时间戳</button>
          <button className="btn btn-secondary" onClick={handleCurrentTime}>获取当前时间戳</button>
        </div>
        {timestampOutput && <div className="result-box">{timestampOutput}</div>}
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>Cron 表达式解析</h2>
          <p>输入标准 5 位或 6 位 Cron 表达式，实时翻译其执行规律</p>
        </div>
        <div className="input-group">
          <input 
            type="text"
            className="form-control" 
            placeholder="* * * * *"
            value={cronInput}
            onChange={(e) => setCronInput(e.target.value)}
          />
        </div>
        <div className="result-box" style={{ fontSize: '1.125rem', color: '#38bdf8' }}>
          {cronOutput || '等待输入...'}
        </div>
      </div>
    </div>
  );
}
