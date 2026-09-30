import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import Portfolio from "@/pages/Portfolio";
import OrderForm from "@/pages/OrderForm";
import TrabajaConNosotros from "@/pages/TrabajaConNosotros";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminApplications from "@/pages/admin/AdminApplications";
import AdminProfile from "@/pages/admin/AdminProfile";

export default function App() {
  return (
    <Routes>
      {/* Sitio público */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/solicitar-proyecto" element={<OrderForm />} />
        <Route path="/trabaja-con-nosotros" element={<TrabajaConNosotros />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Panel admin (protegido) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="pedidos" replace />} />
        <Route path="pedidos" element={<AdminOrders />} />
        <Route path="postulaciones" element={<AdminApplications />} />
        <Route path="perfil" element={<AdminProfile />} />
        <Route path="*" element={<Navigate to="pedidos" replace />} />
      </Route>
    </Routes>
  );
}
