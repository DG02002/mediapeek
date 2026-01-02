import { cn } from '~/lib/utils';

export const MediaIcon = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => (
  <div
    className={cn('bg-foreground inline-block', className)}
    style={{
      maskImage: `url(/icons/${name}.svg)`,
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      maskSize: 'contain',
      WebkitMaskImage: `url(/icons/${name}.svg)`,
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      WebkitMaskSize: 'contain',
    }}
  />
);
