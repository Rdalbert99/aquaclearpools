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
import TechDashboard from "./pages/tech/Dashboard";
import FieldService from "./pages/tech/FieldService";
import ManageClients from "./pages/admin/ManageClients";
import ChemicalCalculator from "./pages/admin/ChemicalCalculator";
import ServiceHistory from "./pages/admin/ServiceHistory";
import ClientView from "./pages/admin/ClientView";
import ClientEdit from "./pages/admin/ClientEdit";
import NewClient from "./pages/admin/NewClient";
import NewService from "./pages/admin/NewService";
import ClientDashboard from "./pages/client/Dashboard";
import ClientServices from "./pages/client/Services";
import RequestService from "./pages/client/RequestService";
import ClientProfile from "./pages/client/Profile";

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
              ) : user?.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : (
                <Navigate to="/tech" replace />
              )
            ) : (
              <Navigate to="/auth/login" replace />
            )
          } 
        />
        
        {/* Admin routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Tech routes */}
        <Route 
          path="/tech" 
          element={
            <ProtectedRoute allowedRoles={['tech']}>
              <TechDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tech/service/:clientId" 
          element={
            <ProtectedRoute allowedRoles={['tech']}>
              <FieldService />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tech/calculator" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <ChemicalCalculator />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tech/services/new" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <NewService />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/clients" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <ManageClients />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/calculator" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <ChemicalCalculator />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/clients/new" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <NewClient />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/clients/:id" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <ClientView />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/clients/:id/edit" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <ClientEdit />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/services" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <ServiceHistory />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/services/new" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <NewService />
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
        <Route 
          path="/client/services" 
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientServices />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/client/request-service" 
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <RequestService />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/client/profile" 
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientProfile />
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
