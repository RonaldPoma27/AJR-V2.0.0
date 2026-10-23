import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import Portfolio from "@/pages/Portfolio";
import OrderForm from "@/pages/OrderForm";
import TrabajaConNosotros from "@/pages/TrabajaConNosotros";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import MiCuenta from "@/pages/account/MiCuenta";
import MisPedidos from "@/pages/account/MisPedidos";
import Soporte from "@/pages/account/Soporte";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminApplications from "@/pages/admin/AdminApplications";
import AdminSupport from "@/pages/admin/AdminSupport";
import AdminPortfolio from "@/pages/admin/AdminPortfolio";
import AdminTeam from "@/pages/admin/AdminTeam";
import AdminTrash from "@/pages/admin/AdminTrash";
import AdminAudit from "@/pages/admin/AdminAudit";

const STAFF = ["ADMIN", "TECHNICIAN"] as const;

export default function App() {
  return (
    <Routes>
      {/* Un único marco para todo el sitio: sin sesión es el sitio público; con sesión suma el Sidebar. */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/solicitar-proyecto" element={<OrderForm />} />
        <Route path="/trabaja-con-nosotros" element={<TrabajaConNosotros />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />

        {/* Cuenta del usuario logueado */}
        <Route path="/cuenta" element={<ProtectedRoute><MiCuenta /></ProtectedRoute>} />
        <Route path="/cuenta/pedidos" element={<ProtectedRoute roles={["USER"]}><MisPedidos /></ProtectedRoute>} />
        <Route path="/cuenta/soporte" element={<ProtectedRoute roles={["USER"]}><Soporte /></ProtectedRoute>} />

        {/* Panel de Administración: ADMIN y TECHNICIAN (la papelera y la auditoría, solo ADMIN) */}
        <Route path="/admin" element={<Navigate to="/admin/pedidos" replace />} />
        <Route path="/admin/pedidos" element={<ProtectedRoute roles={[...STAFF]}><AdminOrders /></ProtectedRoute>} />
        <Route path="/admin/postulaciones" element={<ProtectedRoute roles={[...STAFF]}><AdminApplications /></ProtectedRoute>} />
        <Route path="/admin/soporte" element={<ProtectedRoute roles={[...STAFF]}><AdminSupport /></ProtectedRoute>} />
        <Route path="/admin/portfolio" element={<ProtectedRoute roles={[...STAFF]}><AdminPortfolio /></ProtectedRoute>} />
        <Route path="/admin/equipo" element={<ProtectedRoute roles={[...STAFF]}><AdminTeam /></ProtectedRoute>} />
        <Route path="/admin/papelera" element={<ProtectedRoute roles={["ADMIN"]}><AdminTrash /></ProtectedRoute>} />
        <Route path="/admin/auditoria" element={<ProtectedRoute roles={["ADMIN"]}><AdminAudit /></ProtectedRoute>} />
        <Route path="/admin/perfil" element={<Navigate to="/cuenta" replace />} />
        <Route path="/admin/*" element={<Navigate to="/admin/pedidos" replace />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
