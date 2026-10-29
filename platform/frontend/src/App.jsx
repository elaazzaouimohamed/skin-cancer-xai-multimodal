import { Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAuth, RequireRole, useAuth } from "./auth.jsx";
import AppShell from "./components/AppShell.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import Patients from "./pages/Patients.jsx";
import PatientDetail from "./pages/PatientDetail.jsx";
import NewAnalysis from "./pages/NewAnalysis.jsx";
import AnalysisPage from "./pages/AnalysisPage.jsx";
import History from "./pages/History.jsx";
import Chat from "./pages/Chat.jsx";
import Profile from "./pages/Profile.jsx";
import About from "./pages/About.jsx";

function Home() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <Dashboard />;
}

const STAFF = ["DOCTOR", "ADMIN"];

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/inscription" element={<PublicOnly><Register /></PublicOnly>} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="analyse" element={<NewAnalysis />} />
        <Route path="analyses/:id" element={<AnalysisPage />} />
        <Route path="chat" element={<Chat />} />
        <Route path="historique" element={<History />} />
        <Route path="patients" element={<RequireRole roles={STAFF}><Patients /></RequireRole>} />
        <Route path="patients/:id" element={<RequireRole roles={STAFF}><PatientDetail /></RequireRole>} />
        <Route path="admin/utilisateurs" element={<RequireRole roles={["ADMIN"]}><AdminUsers /></RequireRole>} />
        <Route path="profil" element={<Profile />} />
        <Route path="methode" element={<About />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
