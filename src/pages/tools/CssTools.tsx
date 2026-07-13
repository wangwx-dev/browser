import { useState } from 'react';

export default function CssTools() {
  const [shadowX, setShadowX] = useState(0);
  const [shadowY, setShadowY] = useState(4);
  const [blur, setBlur] = useState(10);
  const [spread, setSpread] = useState(0);
  const [opacity, setOpacity] = useState(0.1);

  const [glassBlur, setGlassBlur] = useState(10);
  const [glassOpacity, setGlassOpacity] = useState(0.2);

  const shadowStyle = `${shadowX}px ${shadowY}px ${blur}px ${spread}px rgba(0, 0, 0, ${opacity})`;
  const glassStyle = {
    background: `rgba(255, 255, 255, ${glassOpacity})`,
    backdropFilter: `blur(${glassBlur}px)`,
    WebkitBackdropFilter: `blur(${glassBlur}px)`,
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
  };

  const glassCode = `background: rgba(255, 255, 255, ${glassOpacity});
backdrop-filter: blur(${glassBlur}px);
-webkit-backdrop-filter: blur(${glassBlur}px);
border: 1px solid rgba(255, 255, 255, 0.18);
box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);`;

  return (
    <div className="page-container">
      <div className="header">
        <h1>CSS 可视化生成器</h1>
      </div>

      <div className="tool-card">
        <div className="tool-header">
          <h2>Box Shadow 生成器</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <div className="input-group">
              <label>X 偏移 (px): {shadowX}</label>
              <input type="range" min="-50" max="50" value={shadowX} onChange={(e) => setShadowX(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>Y 偏移 (px): {shadowY}</label>
              <input type="range" min="-50" max="50" value={shadowY} onChange={(e) => setShadowY(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>模糊半径 (px): {blur}</label>
              <input type="range" min="0" max="100" value={blur} onChange={(e) => setBlur(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>扩张半径 (px): {spread}</label>
              <input type="range" min="-50" max="50" value={spread} onChange={(e) => setSpread(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>透明度: {opacity}</label>
              <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
            </div>
          </div>
          
          <div style={{ flex: '1', minWidth: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ 
              width: '200px', height: '200px', 
              background: 'var(--glass-bg)', 
              borderRadius: '16px',
              boxShadow: shadowStyle,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              预览区域
            </div>
          </div>
        </div>

        <div className="result-box" style={{ marginTop: '1.5rem' }}>
          box-shadow: {shadowStyle};
        </div>
      </div>

      <div className="tool-card" style={{ backgroundImage: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' }}>
        <div className="tool-header" style={{ borderBottomColor: 'rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#333' }}>Glassmorphism (毛玻璃) 生成器</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <div className="input-group">
              <label style={{ color: '#333' }}>模糊度 (px): {glassBlur}</label>
              <input type="range" min="0" max="40" value={glassBlur} onChange={(e) => setGlassBlur(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label style={{ color: '#333' }}>透明度: {glassOpacity}</label>
              <input type="range" min="0" max="1" step="0.01" value={glassOpacity} onChange={(e) => setGlassOpacity(Number(e.target.value))} />
            </div>
          </div>
          
          <div style={{ flex: '1', minWidth: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ 
              width: '200px', height: '200px', 
              borderRadius: '16px',
              ...glassStyle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#333', fontWeight: 'bold'
            }}>
              毛玻璃预览
            </div>
          </div>
        </div>

        <div className="result-box" style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.7)' }}>
          {glassCode}
        </div>
      </div>
    </div>
  );
}
