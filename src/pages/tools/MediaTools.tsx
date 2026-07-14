import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function MediaTools() {
  const [base64Output, setBase64Output] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const [qrInput, setQrInput] = useState('https://github.com/wangwx-dev/browser');
  const [qrSize, setQrSize] = useState(200);

  const handleDrag = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === 'string') {
        setBase64Output(e.target.result);
        setImagePreview(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: any) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      <div className="header">
        <h1>多媒体与图像 (Media Tools)</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Image to Base64 */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tool-header">
            <h2>图片 / SVG 转 Base64</h2>
            <p>拖拽文件至下方区域，本地转换为 Base64 编码</p>
          </div>
          
          <div 
            style={{
              border: `2px dashed ${dragActive ? '#38bdf8' : 'var(--glass-border)'}`,
              borderRadius: '12px',
              padding: '2rem',
              textAlign: 'center',
              background: dragActive ? 'rgba(56, 189, 248, 0.1)' : 'rgba(0,0,0,0.2)',
              transition: 'all 0.2s',
              cursor: 'pointer',
              marginBottom: '1rem',
              position: 'relative'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              accept="image/*,.svg"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              onChange={handleChange}
            />
            <p style={{ color: '#cbd5e1', margin: 0 }}>拖拽文件到这里，或者点击上传</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            {imagePreview && (
              <div style={{ flex: '0 0 100px', height: '100px', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            )}
            <textarea 
              className="form-control" 
              readOnly 
              style={{ flex: 1, height: '100px', fontSize: '0.75rem' }} 
              placeholder="Base64 输出将显示在这里..."
              value={base64Output}
            />
          </div>
        </div>

        {/* QR Code */}
        <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tool-header">
            <h2>二维码生成器 (QR Code)</h2>
            <p>实时生成高质量二维码</p>
          </div>
          
          <div className="input-group">
            <label>内容文本</label>
            <textarea 
              className="form-control" 
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              style={{ height: '80px' }}
            />
          </div>

          <div className="input-group">
            <label>二维码尺寸: {qrSize}px</label>
            <input 
              type="range" 
              min="100" 
              max="400" 
              value={qrSize} 
              onChange={(e) => setQrSize(Number(e.target.value))} 
            />
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', background: '#fff', borderRadius: '12px' }}>
            <QRCodeSVG value={qrInput || ' '} size={qrSize} level="H" includeMargin={true} />
          </div>
        </div>

      </div>
    </div>
  );
}
