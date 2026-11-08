interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: { box: 'size-9 rounded-xl', icon: 'size-5' },
  md: { box: 'size-12 rounded-2xl', icon: 'size-6' },
  lg: { box: 'size-20 rounded-3xl', icon: 'size-10' },
} as const;

export function AppLogo({ size = 'md' }: AppLogoProps) {
  const { box } = SIZE_CLASSES[size];
  return (
    <div className={`shrink-0 overflow-hidden shadow-lg shadow-primary-600/25 ${box}`}>
      <img src="/assets/school-app-icon_(1).png" alt="" className="size-full object-cover" />
    </div>
  );
}
