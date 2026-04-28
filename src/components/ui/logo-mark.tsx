import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const gradientId = useId().replace(/:/g, "");
  const markFillId = `${gradientId}-bindernotes-fill`;
  const spineFillId = `${gradientId}-bindernotes-spine`;
  const lineFillId = `${gradientId}-bindernotes-line`;
  const foldFillId = `${gradientId}-bindernotes-fold`;
  const pageClipId = `${gradientId}-bindernotes-page-clip`;
  const shadowId = `${gradientId}-bindernotes-shadow`;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-transparent shadow-[0_10px_26px_rgba(79,70,229,0.24)]",
        className,
      )}
    >
      <svg
        className="size-full"
        data-icon="inline-start"
        fill="none"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={markFillId} x1="7" x2="58" y1="7" y2="57" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E66FF" />
            <stop offset="0.47" stopColor="#4F46E5" />
            <stop offset="1" stopColor="#9735E8" />
          </linearGradient>
          <linearGradient id={spineFillId} x1="12" x2="24" y1="8" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0B66FF" />
            <stop offset="1" stopColor="#042DBA" />
          </linearGradient>
          <linearGradient id={lineFillId} x1="28" x2="57" y1="23" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#9333EA" />
          </linearGradient>
          <linearGradient id={foldFillId} x1="39" x2="52" y1="44" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#C9C8FF" />
          </linearGradient>
          <filter id={shadowId} colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2.4" floodColor="#172554" floodOpacity="0.22" stdDeviation="2" />
          </filter>
          <clipPath id={pageClipId}>
            <path d="M27.2 9.4h19.6c6.8 0 11.7 4.9 11.7 11.8v21.1c0 9.4-6.8 16.3-16.2 16.3H27.2a8.9 8.9 0 0 1-8.9-8.9V18.3a8.9 8.9 0 0 1 8.9-8.9Z" />
          </clipPath>
        </defs>

        <rect x="5" y="5" width="54" height="54" rx="16.5" fill={`url(#${markFillId})`} />
        <rect x="5.5" y="5.5" width="53" height="53" rx="16" stroke="white" strokeOpacity="0.2" />
        <path d="M15 5h12.8v54H15A16.5 16.5 0 0 1 5 43.9V21.1A16.5 16.5 0 0 1 15 5Z" fill={`url(#${spineFillId})`} opacity="0.96" />

        <path
          d="M27.2 9.4h19.6c6.8 0 11.7 4.9 11.7 11.8v21.1c0 9.4-6.8 16.3-16.2 16.3H27.2a8.9 8.9 0 0 1-8.9-8.9V18.3a8.9 8.9 0 0 1 8.9-8.9Z"
          fill="#FFFFFF"
          filter={`url(#${shadowId})`}
        />

        <g clipPath={`url(#${pageClipId})`}>
          <path d="M28.8 23.9h17.4" stroke={`url(#${lineFillId})`} strokeLinecap="round" strokeWidth="3.2" />
          <path d="M28.8 32.1h18.8" stroke={`url(#${lineFillId})`} strokeLinecap="round" strokeWidth="3.2" />
          <path d="M28.8 40.2h16.9" stroke={`url(#${lineFillId})`} strokeLinecap="round" strokeWidth="3.2" />
          <path d="M28.8 48.4h11.5" stroke={`url(#${lineFillId})`} strokeLinecap="round" strokeWidth="3.2" />

          <path d="M46.1 22.6c1.7-.6 2.9-1.8 3.5-3.5.6 1.7 1.7 2.9 3.5 3.5-1.8.6-2.9 1.7-3.5 3.5-.6-1.8-1.8-2.9-3.5-3.5Z" fill="#6D28D9" />
          <path d="M47.9 32.5c.9-.3 1.5-.9 1.8-1.8.3.9.9 1.5 1.8 1.8-.9.3-1.5.9-1.8 1.8-.3-.9-.9-1.5-1.8-1.8Z" fill="#7C3AED" />
        </g>

        <path d="M39.1 58.3c6.2-.9 11.4-6 12.1-12.6l.8-7.9h-7.9a8.2 8.2 0 0 0-8.2 8.2v12c1 .2 2 .3 3.2.3Z" fill={`url(#${foldFillId})`} />
        <path d="M38.4 56.8c3.4-.7 6.7-2.8 9-5.8" stroke="white" strokeLinecap="round" strokeOpacity="0.9" strokeWidth="2.2" />

        <path d="M10.3 22h12.4" stroke="white" strokeLinecap="round" strokeWidth="5" />
        <path d="M10.3 22h12.4" stroke="#0B49CE" strokeLinecap="round" strokeWidth="2.2" />
        <path d="M10.3 34h12.4" stroke="white" strokeLinecap="round" strokeWidth="5" />
        <path d="M10.3 34h12.4" stroke="#0B49CE" strokeLinecap="round" strokeWidth="2.2" />
        <path d="M10.3 46h12.4" stroke="white" strokeLinecap="round" strokeWidth="5" />
        <path d="M10.3 46h12.4" stroke="#0B49CE" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    </span>
  );
}
