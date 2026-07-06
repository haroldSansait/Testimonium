import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, className, actions }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-6', className)}>
      <div>
        <h1 className="text-3xl font-bold text-crimson-700" style={{ fontFamily: 'Playfair Display, serif' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
    </div>
  );
}
