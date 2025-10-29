import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Equipment from "./pages/Equipment";
import Customers from "./pages/Customers";
import Rentals from "./pages/Rentals";
import Branches from "./pages/Branches";
import Maintenance from "./pages/Maintenance";
import Expenses from "./pages/Expenses";
import NotFound from "./pages/NotFound";
import RentalInvoice from "./pages/RentalInvoice";
import RentalContract from "./pages/RentalContract";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {(() => {
          const isFile =
            typeof window !== "undefined" &&
            window.location.protocol === "file:";
          const isElectron =
            typeof navigator !== "undefined" &&
            navigator.userAgent.includes("Electron");
          const Router = isFile || isElectron ? HashRouter : BrowserRouter;
          return (
            <Router>
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/dashboard" replace />}
                />
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/setup"
                  element={
                    <ProtectedRoute>
                      <Setup />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/equipment"
                  element={
                    <ProtectedRoute>
                      <Equipment />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute>
                      <Customers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rentals"
                  element={
                    <ProtectedRoute>
                      <Rentals />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maintenance"
                  element={
                    <ProtectedRoute>
                      <Maintenance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/expenses"
                  element={
                    <ProtectedRoute>
                      <Expenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rentals/:id/invoice"
                  element={
                    <ProtectedRoute>
                      <RentalInvoice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rentals/:id/contract"
                  element={
                    <ProtectedRoute>
                      <RentalContract />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/branches"
                  element={
                    <ProtectedRoute>
                      <Branches />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Router>
          );
        })()}
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
