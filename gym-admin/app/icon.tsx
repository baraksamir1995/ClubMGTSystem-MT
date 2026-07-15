import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        // ImageResponse renders to a static PNG — CSS variables can't resolve
        // here, so use the literal brand-fill value (--brand-fill, #B8FF2E).
        background: '#B8FF2E',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        color: '#0A0A0A', // --brand-ink
        fontSize: 16,
        fontWeight: 700,
        fontFamily: 'sans-serif',
        letterSpacing: '-0.5px',
      }}
    >
      H
    </div>,
    { ...size },
  );
}
