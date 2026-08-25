import React from 'react';

/**
 * Ingram Micro × Xvantage wordmark lockup, rendered in type to echo the logos.
 * INGRAM + stacked MICRO/® in Ingram blue; a hairline; then Xvantage with the
 * blue X-stroke and grey "vantage". tone swaps it for dark (navy) surfaces.
 */
export const BrandLockup: React.FC<{ tone?: 'ink' | 'on-navy'; className?: string }> = ({
  tone = 'ink',
  className = '',
}) => {
  const primary = tone === 'ink' ? 'text-brand' : 'text-brand-bright';
  const secondary = tone === 'ink' ? 'text-xv' : 'text-on-navy-soft';
  const divider = tone === 'ink' ? 'bg-line' : 'bg-navy-line';

  return (
    <div className={`flex items-center gap-2 select-none leading-none ${className}`} aria-label="Ingram Micro Xvantage">
      <div className="flex items-end gap-0.5">
        <span className={`font-display font-extrabold tracking-[-0.045em] text-[15px] ${primary}`}>INGRAM</span>
        <span className={`flex flex-col font-display font-bold text-[7px] tracking-[0.2em] pb-0.5 ${primary}`}>
          <span>®</span>
          <span>MICRO</span>
        </span>
      </div>
      <span className={`w-px h-5 ${divider}`} />
      <span className="font-display font-bold text-[15px] tracking-[-0.02em]">
        <span className={primary}>X</span>
        <span className={secondary}>vantage</span>
        <sup className={`text-[7px] ml-0.5 ${secondary}`}>™</sup>
      </span>
    </div>
  );
};
