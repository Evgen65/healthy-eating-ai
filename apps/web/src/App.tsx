import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MealsPage } from "./pages/MealsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RecommendationsPage } from "./pages/RecommendationsPage";
import { PlanPage } from "./pages/PlanPage";
import { ShoppingPage } from "./pages/ShoppingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="meals" element={<MealsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="shopping" element={<ShoppingPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
