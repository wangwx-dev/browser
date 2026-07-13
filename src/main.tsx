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
import CssTools from './pages/tools/CssTools.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigation />} />
          <Route path="tools/encode" element={<EncodeTools />} />
          <Route path="tools/json" element={<JsonTools />} />
          <Route path="tools/time" element={<TimeTools />} />
          <Route path="tools/data" element={<DataTools />} />
          <Route path="tools/crypto" element={<CryptoTools />} />
          <Route path="tools/cheatsheets" element={<Cheatsheets />} />
          <Route path="tools/css" element={<CssTools />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
