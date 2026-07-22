import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';

export default function ReportsPage() {
  const [tab, setTab] = useState('ventas');
  return (
    <div>
      <div className="page-header"><h2>Reportes</h2></div>
      <div className="tabs">
        <button className={tab === 'ventas' ? 'active' : ''} onClick={() => setTab('ventas')}>Transacciones</button>
        <button className={tab === 'producto' ? 'active' : ''} onClick={() => setTab('producto')}>Ventas por Producto</button>
        <button className={tab === 'categoria' ? 'active' : ''} onClick={() => setTab('categoria')}>Ventas por Categoría</button>
        <button className={tab === 'inventario' ? 'active' : ''} onClick={() => setTab('inventario')}>Inventario</button>
      </div>
      {tab === 'ventas' && <TransactionsTab />}
      {tab === 'producto' && <AggregateTab groupBy="product" />}
      {tab === 'categoria' && <AggregateTab groupBy="category" />}
      {tab === 'inventario' && <InventoryTab />}
    </div>
  );
}

function TransactionsTab() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const [sales, setSales] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/sales', { params: { from: from || undefined, to: to || undefined } }).then((res) => setSales(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [from, to]);

  async function handleVoid(sale) {
    const reason = prompt(`Motivo de anulación de la venta ${sale.number}:`);
    if (reason === null) return;
    try {
      await api.post(`/sales/${sale.id}/void`, { reason });
      toast.push('Venta anulada, stock repuesto');
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    }
  }

  const total = sales.filter((s) => s.status === 'completada').reduce((sum, s) => sum + s.total, 0);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div style={{ marginLeft: 'auto', fontWeight: 600 }}>Total período: {formatCurrency(total)}</div>
      </div>
      <div className="card">
        {loading ? <div className="empty-state">Cargando...</div> : sales.length === 0 ? (
          <div className="empty-state">Sin ventas para el período seleccionado.</div>
        ) : (
          <table>
            <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Método de Pago</th><th>Total</th><th>Estado</th>{hasRole('admin', 'gerente') && <th></th>}</tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{s.number}</td>
                  <td>{formatDateTime(s.created_at)}</td>
                  <td>{s.customer_name || 'Consumidor Final'}</td>
                  <td>{s.user_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{s.payment_method}</td>
                  <td>{formatCurrency(s.total)}</td>
                  <td><span className={`badge ${s.status === 'anulada' ? 'badge-danger' : 'badge-success'}`}>{s.status}</span></td>
                  {hasRole('admin', 'gerente') && (
                    <td>{s.status === 'completada' && <button className="btn btn-sm btn-danger" onClick={() => handleVoid(s)}>Anular</button>}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AggregateTab({ groupBy }) {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/reports/sales', { params: { groupBy, from: from || undefined, to: to || undefined } }).then((res) => setRows(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [from, to, groupBy]);

  const nameKey = groupBy === 'product' ? 'product' : 'category';
  const chartData = rows.slice(0, 10);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <a className="btn btn-sm" style={{ marginLeft: 'auto' }} href={`/api/reports/sales.csv?groupBy=${groupBy}&from=${from}&to=${to}`} target="_blank" rel="noreferrer">Exportar CSV</a>
      </div>
      {!loading && chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="card">
        {loading ? <div className="empty-state">Cargando...</div> : rows.length === 0 ? <div className="empty-state">Sin datos.</div> : (
          <table>
            <thead>
              <tr>
                {groupBy === 'product' && <><th>Código</th><th>Producto</th><th>Categoría</th></>}
                {groupBy === 'category' && <th>Categoría</th>}
                <th>Unidades</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {groupBy === 'product' && <><td>{r.code}</td><td>{r.product}</td><td>{r.category}</td></>}
                  {groupBy === 'category' && <td>{r.category}</td>}
                  <td>{formatNumber(r.units)}</td>
                  <td>{formatCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InventoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/reports/inventory').then((res) => setRows(res.data)).finally(() => setLoading(false)); }, []);

  const totalCost = rows.reduce((s, r) => s + r.valor_costo, 0);
  const totalSale = rows.reduce((s, r) => s + r.valor_venta, 0);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>Valor total de costo:</strong> {formatCurrency(totalCost)} &nbsp;·&nbsp;
          <strong>Valor total de venta:</strong> {formatCurrency(totalSale)}
        </div>
        <a className="btn btn-sm" href="/api/reports/inventory.csv" target="_blank" rel="noreferrer">Exportar CSV</a>
      </div>
      <div className="card">
        {loading ? <div className="empty-state">Cargando...</div> : (
          <table>
            <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Costo</th><th>Venta</th><th>Valor Costo</th><th>Valor Venta</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td><td>{r.name}</td><td>{r.category}</td>
                  <td style={{ color: r.stock_actual <= r.stock_min ? 'var(--danger)' : 'inherit' }}>{formatNumber(r.stock_actual)}</td>
                  <td>{formatNumber(r.stock_min)}</td>
                  <td>{formatCurrency(r.cost_price)}</td>
                  <td>{formatCurrency(r.sale_price)}</td>
                  <td>{formatCurrency(r.valor_costo)}</td>
                  <td>{formatCurrency(r.valor_venta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
