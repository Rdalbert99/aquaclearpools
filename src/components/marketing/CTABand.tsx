import { Link } from 'react-router-dom';
import { CalendarPlus, Phone, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CTABandProps {
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  onPrimary: () => void;
  showLogin?: boolean;
  variant?: 'muted' | 'plain';
  className?: string;
}

/**
 * Reusable conversion band used between homepage sections so every CTA
 * shares the same look, wording style, and hierarchy.
 */
export const CTABand = ({
  title,
  subtitle,
  primaryLabel = 'Get a Free Pool Assessment',
  onPrimary,
  showLogin = false,
  variant = 'muted',
  className,
}: CTABandProps) => {
  return (
    <section className={cn('px-4 py-14', variant === 'muted' && 'bg-muted/50', className)}>
      <div className="max-w-4xl mx-auto text-center">
        <h3 className="text-2xl md:text-3xl font-bold mb-3">{title}</h3>
        {subtitle && <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">{subtitle}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={onPrimary}>
            <CalendarPlus className="h-5 w-5 mr-2" />
            {primaryLabel}
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="tel:601-447-0399">
              <Phone className="h-5 w-5 mr-2" />
              Call 601-447-0399
            </a>
          </Button>
          {showLogin && (
            <Button asChild size="lg" variant="ghost">
              <Link to="/auth/login?demo=client">
                <LogIn className="h-5 w-5 mr-2" />
                Customer Login
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
