import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import api from '../api/client';
import { formatCurrency, formatNumber } from '../utils/format';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];

export default function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/kpis').then((res) => setKpis(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Cargando dashboard...</div>;
  if (!kpis) return <div className="empty-state">No se pudo cargar el dashboard.</div>;

  return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>

      <div className="kpi-grid">
        <div className="card kpi-card">
          <div className="label">Ventas de Hoy</div>
          <div className="value">{formatCurrency(kpis.todaySales.total)}</div>
          <div className="sub">{kpis.todaySales.count} transacciones</div>
        </div>
        <div className="card kpi-card">
          <div className="label">Valor de Stock (venta)</div>
          <div className="value">{formatCurrency(kpis.stockValue.sale_value)}</div>
          <div className="sub">{formatNumber(kpis.stockValue.total_units)} unidades en {formatCurrency(kpis.stockValue.cost_value)} de costo</div>
        </div>
        <Link to="/productos?lowStock=true" className="card kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="label">Stock Bajo Mínimo</div>
          <div className="value" style={{ color: kpis.lowStockCount > 0 ? 'var(--danger)' : 'inherit' }}>{kpis.lowStockCount}</div>
          <div className="sub">productos por debajo del mínimo</div>
        </Link>
        <Link to="/vencimientos" className="card kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="label">Vencidos / Por Vencer</div>
          <div className="value" style={{ color: kpis.expiredCount > 0 ? 'var(--danger)' : 'inherit' }}>
            {kpis.expiredCount} / {kpis.nearExpiryCount}
          </div>
          <div className="sub">lotes vencidos / próximos a vencer (30 días)</div>
        </Link>
        <Link to="/reposicion" className="card kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="label">Pedidos Sugeridos</div>
          <div className="value" style={{ color: kpis.reorderCount > 0 ? 'var(--warning)' : 'inherit' }}>{kpis.reorderCount}</div>
          <div className="sub">productos para reponer</div>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Ventas últimos 7 días</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={kpis.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Ventas por Categoría (30 días)</h3>
          {kpis.salesByCategory.length === 0 ? (
            <div className="empty-state">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={kpis.salesByCategory} dataKey="total" nameKey="category" outerRadius={90} label={({ category }) => category}>
                  {kpis.salesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Productos más vendidos (30 días)</h3>
        <table>
          <thead><tr><th>Producto</th><th>Unidades</th><th>Total</th></tr></thead>
          <tbody>
            {kpis.topProducts.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{formatNumber(p.qty)}</td>
                <td>{formatCurrency(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
