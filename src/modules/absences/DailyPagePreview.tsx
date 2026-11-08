import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { DAILY_REPORT_CSS } from '@/utils/dailyPageHtml';

const PAGE_WIDTH_PX = 794;

interface DailyPagePreviewProps {
  pages: string[];
  onSectionClick: (section: string) => void;
}

export function DailyPagePreview({ pages, onSectionClick }: DailyPagePreviewProps) {
  return (
    <div className="flex flex-col gap-4">
      <style>{DAILY_REPORT_CSS}</style>
      {pages.map((html, index) => (
        <ScaledPage key={index} html={html} onSectionClick={onSectionClick} />
      ))}
    </div>
  );
}

function ScaledPage({ html, onSectionClick }: { html: string; onSectionClick: (section: string) => void }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const scale = Math.min(1, outer.clientWidth / PAGE_WIDTH_PX);
      setBox({ scale, height: inner.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [html]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const section = (event.target as HTMLElement).closest<HTMLElement>('[data-edit]');
    const name = section?.dataset.edit;
    if (name) onSectionClick(name);
  };

  return (
    <div ref={outerRef} className="w-full overflow-hidden rounded-xl bg-neutral-200 p-1 shadow-sm" style={{ height: box.height + 8 }}>
      <div
        ref={innerRef}
        onClick={handleClick}
        className="origin-top-left"
        style={{ width: PAGE_WIDTH_PX, transform: `scale(${box.scale})`, transformOrigin: 'top left' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
