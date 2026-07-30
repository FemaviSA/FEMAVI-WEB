import { useState, useEffect } from 'react';

const WA_NUMBER = '5491162284649';
const WA_MESSAGE = encodeURIComponent('Hola FEMAVI, me gustaría consultar sobre sus productos.');

export function WhatsAppButton() {
  const [visible, setVisible] = useState(false);
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1500);
    const p = setTimeout(() => setPulse(false), 5000);
    return () => { clearTimeout(t); clearTimeout(p); };
  }, []);

  if (!visible) return null;

  return (
    <a
      href={`https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 9999,
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: '#25D366',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(37,211,102,0.45)',
        textDecoration: 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        animation: pulse ? 'wa-pulse 2s ease infinite' : undefined,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.1)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 28px rgba(37,211,102,0.6)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 20px rgba(37,211,102,0.45)';
      }}
    >
      <style>{`
        @keyframes wa-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(37,211,102,0.45); }
          50% { box-shadow: 0 4px 32px rgba(37,211,102,0.75), 0 0 0 8px rgba(37,211,102,0.15); }
        }
      `}</style>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2C8.268 2 2 8.268 2 16c0 2.47.67 4.79 1.84 6.78L2 30l7.42-1.81A13.93 13.93 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="#25D366"/>
        <path d="M16 3.5C9.096 3.5 3.5 9.096 3.5 16c0 2.27.614 4.392 1.686 6.215L3.5 28.5l6.465-1.66A12.44 12.44 0 0016 28.5c6.904 0 12.5-5.596 12.5-12.5S22.904 3.5 16 3.5z" fill="white"/>
        <path d="M22.03 19.26c-.32-.16-1.9-.94-2.19-1.04-.3-.11-.51-.16-.73.16-.21.32-.83 1.04-1.02 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.56.16-.19.21-.32.32-.54.1-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.07 1.3 3.28c.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.29-.21-.61-.37z" fill="#25D366"/>
      </svg>
    </a>
  );
}
