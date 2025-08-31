import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, Phone, Calendar, LogIn } from 'lucide-react';

interface PublicNavbarProps {
  onRequestService?: () => void;
}

export const PublicNavbar = ({ onRequestService }: PublicNavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const navigationLinks = [
    { label: 'Home', href: '#hero', id: 'home' },
    { label: 'Services', href: '#services', id: 'services' },
    { label: 'See the Difference', href: '#before-after', id: 'before-after' },
    { label: 'Reviews', href: '#reviews', id: 'reviews' },
    { label: 'Contact', href: '#contact', id: 'contact' },
  ];

  const handleNavClick = (href: string) => {
    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      const element = document.querySelector(targetId === 'hero' ? 'section' : `#${targetId}`);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
    setIsOpen(false);
  };

  const NavLinks = ({ className = '' }: { className?: string }) => (
    <nav className={className}>
      {navigationLinks.map((link) => (
        <button
          key={link.id}
          onClick={() => handleNavClick(link.href)}
          className="text-white hover:text-white/80 transition-colors px-3 py-2 text-sm font-medium"
        >
          {link.label}
        </button>
      ))}
    </nav>
  );

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/ac1a09a4-823e-491c-bf59-fb76c8abb196.png" 
              alt="Aqua Clear Pools" 
              className="h-12 w-12 object-contain bg-transparent"
              style={{ 
                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
              }}
            />
            <span className="text-white font-bold text-xl">Aqua Clear Pools</span>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <NavLinks className="hidden md:flex items-center space-x-2" />
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Phone Number - Always Visible */}
            <a href="tel:601-447-0399" className="hidden sm:block">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/10 border-white text-white hover:bg-white/20"
              >
                <Phone className="h-4 w-4 mr-2" />
                601-447-0399
              </Button>
            </a>

            {/* Request Service - Always Visible */}
            <Button 
              variant="outline"
              size="sm" 
              className="bg-primary/20 border-primary text-white hover:bg-primary/30"
              onClick={onRequestService}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {isMobile ? 'Request' : 'Request Service'}
            </Button>

            {/* Login Button - Desktop Only */}
            {!isMobile && (
              <Link to="/auth/login">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-white/10 border-white text-white hover:bg-white/20"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </Link>
            )}

            {/* Mobile Hamburger Menu */}
            {isMobile && (
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white/10 border-white text-white hover:bg-white/20"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent 
                  side="right" 
                  className="bg-background/95 backdrop-blur-lg border-l border-white/20 w-80"
                >
                  <div className="flex flex-col h-full pt-8">
                    {/* Mobile Navigation Links */}
                    <nav className="flex flex-col space-y-4 mb-8">
                      {navigationLinks.map((link) => (
                        <button
                          key={link.id}
                          onClick={() => handleNavClick(link.href)}
                          className="text-foreground hover:text-primary transition-colors px-4 py-3 text-left text-lg font-medium border-b border-border/50"
                        >
                          {link.label}
                        </button>
                      ))}
                    </nav>

                    {/* Mobile Action Buttons */}
                    <div className="flex flex-col space-y-3 mt-auto">
                      <a href="tel:601-447-0399" className="w-full">
                        <Button 
                          variant="outline" 
                          size="lg"
                          className="w-full"
                        >
                          <Phone className="h-5 w-5 mr-2" />
                          Call 601-447-0399
                        </Button>
                      </a>
                      <Link to="/auth/login" className="w-full">
                        <Button 
                          variant="outline" 
                          size="lg"
                          className="w-full"
                        >
                          <LogIn className="h-5 w-5 mr-2" />
                          Customer Login
                        </Button>
                      </Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};