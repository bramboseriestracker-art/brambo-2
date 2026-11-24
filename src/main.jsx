import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth.jsx';
import { ToastProvider } from './lib/toast.jsx';
import App from './App.jsx';
import './styles/base.css';
import './styles/app.css';
import './styles/brambo.css';
import './styles/series.css';
import './styles/theme.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
