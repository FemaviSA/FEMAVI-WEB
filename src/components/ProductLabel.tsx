type Props = {
  name: string;
  category?: string;
  size?: number;
};

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function ProductLabel({ name, category, size = 130 }: Props) {
  const uid = name.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 16);
  const isAerosol = category?.toLowerCase() === 'aerosoles';

  const lines = wrapText(name, isAerosol ? 10 : 13);
  const lineCount = lines.length;
  const lineSpacing = isAerosol ? 9 : 10.5;
  const fontSize = isAerosol
    ? (name.length > 20 ? 5.2 : name.length > 13 ? 5.8 : name.length > 9 ? 6.3 : 7)
    : (name.length > 22 ? 6.5 : name.length > 15 ? 7.5 : 8.5);
  // aerosol label content area: y=61 (separator) to y=94 (label bottom) → height 33
  // drum label content area: y=62 to y=97 → height 35
  const textStartY = isAerosol
    ? 61 + (33 - lineCount * lineSpacing) / 2 + 7
    : 62 + (35 - lineCount * lineSpacing) / 2 + 8;

  return (
    <svg
      viewBox="0 0 112 106"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`body-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ccdee9" />
          <stop offset="12%" stopColor="#edf5fb" />
          <stop offset="88%" stopColor="#edf5fb" />
          <stop offset="100%" stopColor="#ccdee9" />
        </linearGradient>
        <linearGradient id={`top-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#deeaf4" />
          <stop offset="100%" stopColor="#ccdde9" />
        </linearGradient>
        <linearGradient id={`handle-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d0e2ee" />
          <stop offset="100%" stopColor="#b8cdd9" />
        </linearGradient>
        <linearGradient id={`cap-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e7edf1" />
          <stop offset="100%" stopColor="#c9d8e1" />
        </linearGradient>
      </defs>

      {isAerosol ? (
        <>
          {/* ── CAN BODY (slim cylinder) ── */}
          <rect x="30" y="10" width="52" height="92" rx="7"
            fill={`url(#body-${uid})`} stroke="#b0c8d8" strokeWidth="1" />

          {/* ── LID BAND ── */}
          <rect x="30" y="10" width="52" height="14" rx="7"
            fill={`url(#cap-${uid})`} stroke="#a9c0cd" strokeWidth="0.8" />
          <rect x="30" y="18" width="52" height="6" fill={`url(#cap-${uid})`} />
          {/* Crimp line */}
          <rect x="30" y="23" width="52" height="2" fill="#9db3bf" />

          {/* ── ACTUATOR BUTTON ── */}
          <rect x="46" y="0" width="20" height="9" rx="3" fill="#3f4d55" />
          {/* Side spray nozzle */}
          <rect x="65" y="2" width="11" height="3.5" rx="1.4" fill="#3f4d55" />
          {/* Spray hint lines */}
          <line x1="78" y1="2.5" x2="84" y2="0.5" stroke="#a9c0cd" strokeWidth="0.9" opacity="0.7" />
          <line x1="79" y1="4" x2="85.5" y2="3" stroke="#a9c0cd" strokeWidth="0.9" opacity="0.7" />

          {/* Gloss highlight */}
          <rect x="38" y="26" width="4" height="72" rx="2" fill="#ffffff" opacity="0.35" />
          {/* Depth edges */}
          <rect x="30" y="26" width="5" height="76" rx="2.5" fill="#bad2e2" opacity="0.6" />
          <rect x="77" y="26" width="5" height="76" rx="2.5" fill="#bad2e2" opacity="0.6" />
          <rect x="30" y="96" width="52" height="6" rx="3" fill="#aac4d4" opacity="0.5" />

          {/* ── LABEL ── */}
          <rect x="34" y="44" width="44" height="50" rx="4"
            fill="white" stroke="#ccdde8" strokeWidth="0.8" />
          <rect x="34" y="44" width="44" height="15" rx="4" fill="#0067ac" />
          <rect x="34" y="53" width="44" height="6" fill="#0067ac" />
          <text x="56" y="54.5" textAnchor="middle" fill="white"
            fontSize="5.5" fontWeight="800"
            fontFamily="Arial, sans-serif" letterSpacing="1.2">
            FEMAVI
          </text>
          <line x1="39" y1="60" x2="73" y2="60" stroke="#e4eef5" strokeWidth="0.6" />
        </>
      ) : (
        <>
          {/* ── TOP PANEL ── */}
          <rect x="4" y="16" width="104" height="12" rx="4"
            fill={`url(#top-${uid})`} stroke="#b0c8d8" strokeWidth="0.8" />

          {/* ── HANDLE (top-right recess) ── */}
          <rect x="66" y="4" width="40" height="26" rx="6"
            fill={`url(#handle-${uid})`} stroke="#b0c8d8" strokeWidth="0.8" />
          {/* Handle inner cutout */}
          <rect x="70" y="8" width="32" height="14" rx="4" fill="#a8bfcc" />
          {/* Handle inner highlight */}
          <rect x="70" y="8" width="32" height="5" rx="3" fill="#b8cedb" />

          {/* ── CAP (top-left) ── */}
          {/* Yellow safety ring */}
          <rect x="9" y="14" width="26" height="5" rx="2" fill="#e8c840" />
          {/* Black screw cap */}
          <rect x="9" y="3" width="26" height="14" rx="5" fill="#1a1a1a" />
          {/* Cap ridges */}
          {[14, 18, 22, 26, 30].map(cx => (
            <line key={cx} x1={cx} y1="4" x2={cx} y2="15"
              stroke="#333" strokeWidth="1.2" />
          ))}
          {/* Cap highlight */}
          <rect x="11" y="4" width="8" height="4" rx="2" fill="#444" opacity="0.6" />

          {/* ── MAIN BODY ── */}
          <rect x="4" y="24" width="104" height="78" rx="7"
            fill={`url(#body-${uid})`} stroke="#b0c8d8" strokeWidth="1" />

          {/* Left depth edge */}
          <rect x="4" y="24" width="6" height="78" rx="4"
            fill="#bad2e2" opacity="0.6" />
          {/* Right depth edge */}
          <rect x="102" y="24" width="6" height="78" rx="4"
            fill="#bad2e2" opacity="0.6" />
          {/* Bottom depth */}
          <rect x="4" y="96" width="104" height="6" rx="4"
            fill="#aac4d4" opacity="0.5" />

          {/* Subtle horizontal ribs */}
          <rect x="4" y="36" width="104" height="1.5" fill="#c0d8e6" opacity="0.5" />
          <rect x="4" y="95" width="104" height="1.5" fill="#c0d8e6" opacity="0.5" />

          {/* ── LABEL ── */}
          <rect x="13" y="42" width="86" height="57" rx="4"
            fill="white" stroke="#ccdde8" strokeWidth="0.8" />
          <rect x="13" y="42" width="86" height="20" rx="4" fill="#0067ac" />
          <rect x="13" y="54" width="86" height="8" fill="#0067ac" />
          <text x="56" y="56" textAnchor="middle" fill="white"
            fontSize="7" fontWeight="800"
            fontFamily="Arial, sans-serif" letterSpacing="2.5">
            FEMAVI
          </text>
          <line x1="22" y1="63.5" x2="90" y2="63.5"
            stroke="#e4eef5" strokeWidth="0.6" />
        </>
      )}

      {/* Product name */}
      {lines.map((line, i) => (
        <text
          key={i}
          x="56"
          y={textStartY + i * lineSpacing}
          textAnchor="middle"
          fill="#003a6b"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="Arial, sans-serif"
        >
          {line}
        </text>
      ))}

      {/* Category */}
      {category && (
        <text x="56" y={isAerosol ? 90 : 94} textAnchor="middle"
          fill="#7a9ab4" fontSize={isAerosol ? 4 : 5}
          fontFamily="Arial, sans-serif" letterSpacing={isAerosol ? 0.3 : 0.5}>
          {category.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
