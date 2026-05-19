import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.tsx";
import RequireAdmin from "./auth/RequireAdmin.tsx";
import RequireAuth from "./auth/RequireAuth.tsx";
import App from "./App.tsx";
import AddressesPage from "./pages/AddressesPage.tsx";
import AffiliationsPage from "./pages/AffiliationsPage.tsx";
import AnalyticsPage from "./pages/AnalyticsPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import UsersPage from "./pages/UsersPage.tsx";
import AgreementTemplatePage from "./pages/AgreementTemplatePage.tsx";

export default function RootRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<App />}>
            <Route index element={<DashboardPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="addresses" element={<AddressesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="agreement-template" element={<AgreementTemplatePage />} />
            </Route>
            <Route path="affiliations" element={<AffiliationsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
