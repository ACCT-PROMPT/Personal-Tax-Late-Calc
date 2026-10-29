import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const sessionCheck = window.setInterval(async () => {
  if (document.hidden) return;
  try {
    const response = await fetch('/__member-session', { cache: 'no-store' });
    if (response.status !== 401) return;
    window.clearInterval(sessionCheck);
    const root = document.getElementById('root');
    if (root) {
      root.textContent = '';
      const section = document.createElement('main');
      section.style.cssText = 'max-width:640px;margin:12vh auto;padding:24px;font:16px system-ui,sans-serif;color:#261c36';
      const heading = document.createElement('h1');
      heading.textContent = 'สิทธิ์ใช้งานหมดอายุหรือถูกยกเลิก';
      const message = document.createElement('p');
      message.textContent = 'กรุณากลับไปตรวจสอบสิทธิ์และเปิดโปรแกรมจากหน้าโปรแกรมของฉัน';
      const link = document.createElement('a');
      link.href = 'https://acctprompt.com/my-programs';
      link.target = '_top';
      link.textContent = 'กลับไปโปรแกรมของฉัน';
      section.append(heading, message, link);
      root.append(section);
    }
  } catch {
    // Network interruptions do not reset the calculator or discard local history.
  }
}, 5 * 60 * 1000);

window.addEventListener('pagehide', () => window.clearInterval(sessionCheck), { once: true });
