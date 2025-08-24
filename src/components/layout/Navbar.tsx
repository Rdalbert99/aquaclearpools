import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Droplets, Home, Calculator, Users, FileText, LogOut, User, Star, Calendar, BarChart3 } from 'lucide-react';

export const Navbar = () => {
  const { user, signOut, isAdmin, isTech, isClient } = useAuth();
  const navigate = useNavigate();

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
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {isAdmin && (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin" className="flex items-center space-x-1">
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/clients" className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>Clients</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/service-request-management" className="flex items-center space-x-1">
                      <FileText className="h-4 w-4" />
                      <span>Requests</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/reviews" className="flex items-center space-x-1">
                      <Star className="h-4 w-4" />
                      <span>Reviews</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/calculator" className="flex items-center space-x-1">
                      <Calculator className="h-4 w-4" />
                      <span>Calculator</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/reports" className="flex items-center space-x-1">
                      <BarChart3 className="h-4 w-4" />
                      <span>Reports</span>
                    </Link>
                  </Button>
                </>
              )}

              {isTech && (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tech" className="flex items-center space-x-1">
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tech/schedule" className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Schedule</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tech/calculator" className="flex items-center space-x-1">
                      <Calculator className="h-4 w-4" />
                      <span>Calculator</span>
                    </Link>
                  </Button>
                </>
              )}

              {isClient && (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/client" className="flex items-center space-x-1">
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/client/services" className="flex items-center space-x-1">
                      <FileText className="h-4 w-4" />
                      <span>Services</span>
                    </Link>
                  </Button>
                </>
              )}
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