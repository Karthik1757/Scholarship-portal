import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProfileWizard from "./pages/ProfileWizard";
import Dashboard from "./pages/Dashboard";
import ScholarshipDetail from "./pages/ScholarshipDetail";
import AdminDashboard from "./pages/AdminDashboard";
import ProfileEdit from "./pages/ProfileEdit";
import AllScholarships from "./pages/AllScholarships";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import MyApplications from "./pages/MyApplications";
import { Chatbot } from "@/components/Chatbot";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile-wizard" element={<ProfileWizard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scholarship/:id" element={<ScholarshipDetail />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/profile-edit" element={<ProfileEdit />} />
              <Route path="/scholarships" element={<AllScholarships />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/my-applications" element={<MyApplications />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            {/* Persistent Chatbot Widget */}
            <Chatbot />
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
