import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="empty-state">
        <h3>Acceso restringido</h3>
        <p>No tiene permisos para ver esta sección.</p>
      </div>
    );
  }
  return children;
}
