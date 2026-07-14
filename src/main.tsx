import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

// Pages
import Navigation from './pages/Navigation.tsx';
import JsonTools from './pages/tools/JsonTools.tsx';
import EncodeTools from './pages/tools/EncodeTools.tsx';
import TimeTools from './pages/tools/TimeTools.tsx';
import DataTools from './pages/tools/DataTools.tsx';
import CryptoTools from './pages/tools/CryptoTools.tsx';
import Cheatsheets from './pages/tools/Cheatsheets.tsx';
import DockerTools from './pages/tools/DockerTools.tsx';
import DiffViewer from './pages/tools/DiffViewer.tsx';

// New Pages
import NetworkTools from './pages/tools/NetworkTools.tsx';
import SecurityTools from './pages/tools/SecurityTools.tsx';
import ConverterTools from './pages/tools/ConverterTools.tsx';
import TextTools from './pages/tools/TextTools.tsx';
import MediaTools from './pages/tools/MediaTools.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigation />} />
          <Route path="tools/encode" element={<EncodeTools />} />
          <Route path="tools/json" element={<JsonTools />} />
          <Route path="tools/docker" element={<DockerTools />} />
          <Route path="tools/diff" element={<DiffViewer />} />
          <Route path="tools/time" element={<TimeTools />} />
          <Route path="tools/data" element={<DataTools />} />
          <Route path="tools/crypto" element={<CryptoTools />} />
          <Route path="tools/cheatsheets" element={<Cheatsheets />} />
          
          <Route path="tools/network" element={<NetworkTools />} />
          <Route path="tools/security" element={<SecurityTools />} />
          <Route path="tools/converter" element={<ConverterTools />} />
          <Route path="tools/text" element={<TextTools />} />
          <Route path="tools/media" element={<MediaTools />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
