import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Navbar } from "./components/layout/Navbar";
import { LoadingSpinner } from "./components/ui/loading-spinner";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import AdminDashboard from "./pages/admin/Dashboard";
import ClientDashboard from "./pages/client/Dashboard";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && <Navbar />}
      <Routes>
        {/* Public routes */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<Signup />} />
        
        {/* Protected routes */}
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              user?.role === 'client' ? (
                <Navigate to="/client" replace />
              ) : (
                <Navigate to="/admin" replace />
              )
            ) : (
              <Navigate to="/auth/login" replace />
            )
          } 
        />
        
        {/* Admin/Tech routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Client routes */}
        <Route 
          path="/client" 
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
