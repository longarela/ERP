import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const NAV = [
  { section: 'General', items: [
    { to: '/', label: 'Dashboard', icon: '📊', end: true },
    { to: '/pos', label: 'Punto de Venta', icon: '🛒' },
  ]},
  { section: 'Inventario', items: [
    { to: '/productos', label: 'Productos', icon: '📦' },
    { to: '/catalogo', label: 'Categorías y Proveedores', icon: '🏷️', roles: ['admin', 'gerente'] },
    { to: '/stock', label: 'Stock y Movimientos', icon: '🔄' },
    { to: '/vencimientos', label: 'Vencimientos', icon: '⏰' },
  ]},
  { section: 'Reposición', items: [
    { to: '/reposicion', label: 'Pedidos Sugeridos', icon: '💡', roles: ['admin', 'gerente'] },
    { to: '/ordenes-compra', label: 'Órdenes de Compra', icon: '📝', roles: ['admin', 'gerente'] },
  ]},
  { section: 'Comercial', items: [
    { to: '/clientes', label: 'Clientes', icon: '👥' },
    { to: '/reportes', label: 'Reportes', icon: '📈', roles: ['admin', 'gerente'] },
  ]},
  { section: 'Sistema', items: [
    { to: '/configuracion', label: 'Configuración', icon: '⚙️', roles: ['admin'] },
    { to: '/usuarios', label: 'Usuarios', icon: '🔑', roles: ['admin'] },
    { to: '/auditoria', label: 'Auditoría', icon: '🛡️', roles: ['admin', 'gerente'] },
  ]},
];

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>🏪 ERP POS</h1>
        <nav>
          {NAV.map((group) => {
            const visibleItems = group.items.filter((i) => !i.roles || hasRole(...i.roles));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.section}>
                <div className="section-label">{group.section}</div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    <span>{item.icon}</span> {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="theme-toggle" onClick={toggleTheme} title="Cambiar tema">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
            <button className="btn btn-sm" onClick={logout}>Salir</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
