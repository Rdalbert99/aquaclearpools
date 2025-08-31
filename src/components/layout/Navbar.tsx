import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Droplets, Home, Calculator, Users, FileText, LogOut, User, Star, Calendar, BarChart3, Mail, Menu } from 'lucide-react';

export const Navbar = () => {
  const { user, signOut, isAdmin, isTech, isClient } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Navigation items based on user role
  const getNavigationItems = () => {
    if (isAdmin) {
      return [
        { label: 'Dashboard', icon: Home, path: '/admin' },
        { label: 'Clients', icon: Users, path: '/admin/clients' },
        { label: 'Requests', icon: FileText, path: '/admin/service-request-management' },
        { label: 'Reviews', icon: Star, path: '/admin/reviews' },
        { label: 'Calculator', icon: Calculator, path: '/admin/calculator' },
        { label: 'Reports', icon: BarChart3, path: '/admin/reports' },
        { label: 'Mailjet Test', icon: Mail, path: '/admin/mailjet-test' },
      ];
    }
    
    if (isTech) {
      return [
        { label: 'Dashboard', icon: Home, path: '/tech' },
        { label: 'Schedule', icon: Calendar, path: '/tech/schedule' },
        { label: 'Calculator', icon: Calculator, path: '/tech/calculator' },
      ];
    }
    
    if (isClient) {
      return [
        { label: 'Dashboard', icon: Home, path: '/client' },
        { label: 'Services', icon: FileText, path: '/client/services' },
      ];
    }
    
    return [];
  };

  const navigationItems = getNavigationItems();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <img 
                src="/lovable-uploads/77c07711-430c-44ce-bbd3-290293acb2c4.png" 
                alt="Aqua Clear Pools" 
                className="h-8 w-8 object-contain"
              />
              <span className="text-xl font-bold text-gray-900">Aqua Clear Pools</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigationItems.map((item) => (
                <Button key={item.path} variant="ghost" size="sm" asChild>
                  <Link to={item.path} className="flex items-center space-x-1">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              ))}
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="lg:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent 
                  side="right" 
                  className="bg-background border-l w-80 z-[100]"
                >
                  <div className="flex flex-col h-full pt-8">
                    {/* Mobile Navigation Links */}
                    <nav className="flex flex-col space-y-2 mb-8">
                      {navigationItems.map((item) => (
                        <Button
                          key={item.path}
                          variant="ghost"
                          size="lg"
                          asChild
                          className="w-full justify-start"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Link to={item.path} className="flex items-center space-x-3">
                            <item.icon className="h-5 w-5" />
                            <span className="text-lg">{item.label}</span>
                          </Link>
                        </Button>
                      ))}
                    </nav>

                    {/* Mobile User Actions */}
                    <div className="flex flex-col space-y-3 mt-auto border-t pt-4">
                      <Button
                        variant="ghost"
                        size="lg"
                        asChild
                        className="w-full justify-start"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Link to="/profile" className="flex items-center space-x-3">
                          <User className="h-5 w-5" />
                          <span className="text-lg">Profile</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="lg"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          handleLogout();
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <LogOut className="h-5 w-5 mr-3" />
                        <span className="text-lg">Log out</span>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user?.name || user?.email || 'U')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {user?.role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};