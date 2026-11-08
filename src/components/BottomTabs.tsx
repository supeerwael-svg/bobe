import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface BottomTabsProps<T extends string> {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function BottomTabs<T extends string>({ items, active, onChange }: BottomTabsProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the active tab visible (works in both RTL and LTR)
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul
        ref={listRef}
        className="flex w-full touch-pan-x items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 py-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <li key={item.id} className="flex w-20 flex-none">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="group flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition duration-200"
              >
                <span
                  className={`flex h-8 w-16 items-center justify-center rounded-full transition duration-200 ${
                    isActive ? 'bg-primary-100 text-primary-700' : 'text-neutral-500 group-hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="size-6" aria-hidden />
                </span>
                <span
                  className={`whitespace-nowrap text-xs ${isActive ? 'font-medium text-primary-700' : 'text-neutral-500'}`}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
