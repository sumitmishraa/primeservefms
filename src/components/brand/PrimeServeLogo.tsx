import Image from 'next/image';

const FULL_LOGO = '/images/brand/primeserve-logo-full.png';
const MARK_LOGO = '/images/brand/primeserve-logo-mark.png';
const FULL_LOGO_LIGHT = '/images/brand/primeserve-logo-full-light.png';
const MARK_LOGO_LIGHT = '/images/brand/primeserve-logo-mark-light.png';

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface PrimeServeLogoProps {
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'default' | 'light';
  surface?: 'none' | 'white';
  className?: string;
  priority?: boolean;
}

export default function PrimeServeLogo({
  variant = 'full',
  size = 'md',
  tone = 'default',
  surface = 'none',
  className,
  priority = false,
}: PrimeServeLogoProps) {
  const isMark = variant === 'mark';
  const src = isMark
    ? tone === 'light'
      ? MARK_LOGO_LIGHT
      : MARK_LOGO
    : tone === 'light'
      ? FULL_LOGO_LIGHT
      : FULL_LOGO;
  const sizeClass = isMark
    ? {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-14 w-14',
        xl: 'h-20 w-20',
      }[size]
    : {
        sm: 'h-8 w-[124px]',
        md: 'h-10 w-[154px]',
        lg: 'h-12 w-[184px]',
        xl: 'h-16 w-[245px]',
      }[size];

  return (
    <span
      className={joinClasses(
        'relative inline-flex shrink-0 overflow-hidden',
        surface === 'white' && 'bg-white',
        surface === 'white' && (isMark ? 'rounded-xl' : 'rounded-md'),
        sizeClass,
        className,
      )}
    >
      <Image
        src={src}
        alt={isMark ? 'PrimeServe logo' : 'PrimeServe'}
        fill
        sizes={isMark ? '80px' : '245px'}
        priority={priority}
        className="object-contain"
      />
    </span>
  );
}
