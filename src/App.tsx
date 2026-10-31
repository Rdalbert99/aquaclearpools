import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { SecurityHeader } from "./components/security/SecurityHeader";
import { Navbar } from "./components/layout/Navbar";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import { UpdatePrompt } from "./components/pwa/UpdatePrompt";
import { InstallPrompt } from "./components/pwa/InstallPrompt";
const WhatsNew = lazy(() => import("./pages/WhatsNew"));



// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
const Signup = lazy(() => import("./pages/auth/Signup"));
const ClientSignup = lazy(() => import("./pages/auth/ClientSignup"));
const ClientInvite = lazy(() => import("./pages/auth/ClientInvite"));
const TechInvite = lazy(() => import("./pages/auth/TechInvite"));
const ChangePassword = lazy(() => import("./pages/auth/ChangePassword"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const WebsiteAnalytics = lazy(() => import("./pages/admin/Analytics"));
const TechDashboard = lazy(() => import("./pages/tech/Dashboard"));
const FieldService = lazy(() => import("./pages/tech/FieldService"));
const TechSchedule = lazy(() => import("./pages/tech/Schedule"));
const MyClients = lazy(() => import("./pages/tech/MyClients"));
const ManageClients = lazy(() => import("./pages/admin/ManageClients"));
const ChemicalCalculator = lazy(() => import("./pages/admin/ChemicalCalculator"));
const ChemicalCatalog = lazy(() => import("./pages/admin/ChemicalCatalog"));
const Inventory = lazy(() => import("./pages/admin/Inventory"));
const Billing = lazy(() => import("./pages/admin/Billing"));
const InvoiceDelivery = lazy(() => import("./pages/admin/InvoiceDelivery"));
const QuickBooksConnection = lazy(() => import("./pages/admin/QuickBooksConnection"));
const InventoryBackfill = lazy(() => import("./pages/admin/InventoryBackfill"));
const ServiceHistory = lazy(() => import("./pages/admin/ServiceHistory"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const ClientView = lazy(() => import("./pages/admin/ClientView"));
const ClientEdit = lazy(() => import("./pages/admin/ClientEdit"));
const AdminClientServices = lazy(() => import("./pages/admin/ClientServices"));
const NewClient = lazy(() => import("./pages/admin/NewClient"));
const NewService = lazy(() => import("./pages/admin/NewService"));
const ReviewManagement = lazy(() => import("./pages/admin/ReviewManagement"));
const ServiceRequestManagement = lazy(() => import("./pages/admin/ServiceRequestManagement"));
const ApprovalCenter = lazy(() => import("./pages/admin/ApprovalCenter").then((m) => ({ default: m.ApprovalCenter })));
const ServiceRequestDetails = lazy(() => import("./pages/admin/ServiceRequestDetails"));
const PotentialCustomers = lazy(() => import("./pages/admin/PotentialCustomers"));
const CreateUser = lazy(() => import("./pages/admin/CreateUser"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const ManageAdmins = lazy(() => import("./pages/admin/ManageAdmins"));
const ManageTechs = lazy(() => import("./pages/admin/ManageTechs"));
const ClientDashboard = lazy(() => import("./pages/client/Dashboard"));
const ClientServices = lazy(() => import("./pages/client/Services"));
const RequestService = lazy(() => import("./pages/client/RequestService"));
const ClientProfile = lazy(() => import("./pages/client/Profile"));
const Profile = lazy(() => import("./pages/Profile"));
const Contact = lazy(() => import("./pages/Contact"));
const Services = lazy(() => import("./pages/Services"));
const Commercial = lazy(() => import("./pages/Commercial"));
const CommercialPortal = lazy(() => import("./pages/commercial/Portal"));
const CommercialPortalLogin = lazy(() => import("./pages/commercial/PortalLogin"));
const CommercialAccounts = lazy(() => import("./pages/admin/CommercialAccounts"));
const CommercialExecutive = lazy(() => import("./pages/admin/CommercialExecutive"));



const OptinProof = lazy(() => import("./pages/OptinProof"));
const MailjetTest = lazy(() => import("./pages/admin/MailjetTest"));
const SMSTest = lazy(() => import("./pages/admin/SMSTest"));
const InboundMessages = lazy(() => import("./pages/admin/InboundMessages"));
const MessageLogs = lazy(() => import("./pages/admin/MessageLogs"));
const TelnyxStatus = lazy(() => import("./pages/admin/TelnyxStatus"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const ServiceDashboard = lazy(() => import("./pages/ServiceDashboard"));
const NotificationTemplates = lazy(() => import("./pages/admin/NotificationTemplates"));
const BroadcastSMS = lazy(() => import("./pages/admin/BroadcastSMS"));
const SMSForwardingSettings = lazy(() => import("./pages/admin/SMSForwardingSettings"));

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && <Navbar />}
      <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <Routes>
        {/* Public routes - Landing page accessible to all users */}
        <Route path="/" element={<Index />} />
        <Route path="/services" element={<Services />} />
        <Route path="/commercial" element={<Commercial />} />
        <Route path="/commercial/login" element={<CommercialPortalLogin />} />
        <Route path="/commercial/portal" element={<CommercialPortal />} />


        <Route path="/contact" element={<Contact />} />
        <Route path="/opt-in-proof" element={<OptinProof />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<Signup />} />
        <Route path="/auth/client-signup" element={<ClientSignup />} />
        <Route path="/auth/invite/:token" element={<ClientInvite />} />
        <Route path="/auth/tech-invite/:token" element={<TechInvite />} />
        <Route path="/auth/change-password" element={<ChangePassword />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
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
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech', 'client']}>
              <Profile />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin routes */}
        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><WebsiteAnalytics /></ProtectedRoute>} />
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
            <ProtectedRoute allowedRoles={['tech', 'admin']}>
              <FieldService />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/follow-ups" 
          element={
            <ProtectedRoute allowedRoles={['tech', 'admin']}>
              <FollowUps />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/service-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['tech', 'admin']}>
              <ServiceDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tech/schedule" 
          element={
            <ProtectedRoute allowedRoles={['tech']}>
              <TechSchedule />
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
          path="/tech/clients" 
          element={
            <ProtectedRoute allowedRoles={['tech']}>
              <MyClients />
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
          path="/admin/chemical-catalog"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ChemicalCatalog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/quickbooks"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <QuickBooksConnection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/invoice-delivery"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <InvoiceDelivery />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory/backfill"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <InventoryBackfill />
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
          path="/admin/clients/:id/services" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <AdminClientServices />
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
        <Route 
          path="/admin/reviews" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ReviewManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/service-request/:id" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <ServiceRequestDetails />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/potential-customers" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PotentialCustomers />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/service-request-management" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ServiceRequestManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/approvals" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ApprovalCenter />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/users/new" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <CreateUser />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/admins" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ManageAdmins />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/techs" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ManageTechs />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/reports" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Reports />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/mailjet-test" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MailjetTest />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/sms-test" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SMSTest />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/inbound-messages" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <InboundMessages />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/message-logs" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'tech']}>
              <MessageLogs />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/telnyx-status" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <TelnyxStatus />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/admin/commercial"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CommercialAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/commercial-dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CommercialExecutive />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/admin/notification-templates" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <NotificationTemplates />
            </ProtectedRoute>
          } 
        />
        <Route path="/admin/broadcast" element={<ProtectedRoute allowedRoles={['admin']}><BroadcastSMS /></ProtectedRoute>} />
        <Route 
          path="/admin/sms-forwarding" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SMSForwardingSettings />
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
        
        {/* Release notes */}
        <Route path="/whats-new" element={<WhatsNew />} />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <MobileBottomNav />
      <UpdatePrompt />
      <InstallPrompt />

      {isAuthenticated && <div className="h-16 lg:hidden" aria-hidden="true" />}
    </div>
  );
};


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SecurityHeader>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </SecurityHeader>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
