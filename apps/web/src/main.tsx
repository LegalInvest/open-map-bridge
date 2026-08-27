import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'ol/ol.css';
import './styles.css';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('root element is missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
