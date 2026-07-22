import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';

export default function ReorderPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('sugerencias');
  const [windowDays, setWindowDays] = useState(30);
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState({});
  const [qtyOverride, setQtyOverride] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api.get('/reorder/suggestions', { params: { windowDays } }).then((res) => {
      setSuggestions(res.data);
      const sel = {}, qty = {};
      res.data.forEach((s) => { sel[s.product.id] = true; qty[s.product.id] = s.suggestedQty; });
      setSelected(sel);
      setQtyOverride(qty);
    }).finally(() => setLoading(false));
  }
  useEffect(load, [windowDays]);

  useEffect(() => {
    if (tab === 'historial') {
      api.get('/reorder/history').then((res) => setHistory(res.data));
    }
  }, [tab]);

  const groupedBySupplier = useMemo(() => {
    const groups = {};
    for (const s of suggestions) {
      const key = s.product.supplier_id || 'sin-proveedor';
      if (!groups[key]) groups[key] = { supplierName: s.product.supplier_name || 'Sin proveedor', supplierId: s.product.supplier_id, items: [] };
      groups[key].items.push(s);
    }
    return Object.values(groups);
  }, [suggestions]);

  async function handleGeneratePO(group) {
    const items = group.items
      .filter((s) => selected[s.product.id])
      .map((s) => ({ productId: s.product.id, quantity: Number(qtyOverride[s.product.id] || 0), unitCost: s.product.cost_price, suggestedQty: s.suggestedQty }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) { toast.push('Seleccione al menos un producto con cantidad', 'error'); return; }
    if (!group.supplierId) { toast.push('No se puede generar una orden sin proveedor asignado', 'error'); return; }
    setCreating(true);
    try {
      const { data: po } = await api.post('/purchase-orders', { supplierId: group.supplierId, items });
      toast.push(`Orden de compra ${po.number} generada`);
      navigate('/ordenes-compra');
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Pedidos Sugeridos por Demanda</h2>
        <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} style={{ width: 200 }}>
          <option value={30}>Analizar últimos 30 días</option>
          <option value={60}>Analizar últimos 60 días</option>
          <option value={90}>Analizar últimos 90 días</option>
        </select>
      </div>
      <div className="tabs">
        <button className={tab === 'sugerencias' ? 'active' : ''} onClick={() => setTab('sugerencias')}>Productos a Pedir</button>
        <button className={tab === 'historial' ? 'active' : ''} onClick={() => setTab('historial')}>Historial de Sugerencias</button>
      </div>

      {tab === 'sugerencias' && (
        loading ? <div className="empty-state">Calculando sugerencias...</div> :
        suggestions.length === 0 ? <div className="empty-state">No hay productos que requieran reposición en este momento. 🎉</div> : (
          groupedBySupplier.map((group) => (
            <div className="card" key={group.supplierId || 'sin-proveedor'} style={{ marginBottom: 20 }}>
              <div className="page-header" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{group.supplierName}</h3>
                <button className="btn btn-primary btn-sm" disabled={creating || !group.supplierId} onClick={() => handleGeneratePO(group)}>
                  Generar Orden de Compra
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th></th><th>Producto</th><th>Stock Actual</th><th>Venta Prom./día</th>
                    <th>Punto Reorden</th><th>Días de Stock</th><th>Cant. Sugerida</th><th>Cant. a Pedir</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((s) => (
                    <tr key={s.product.id}>
                      <td><input type="checkbox" style={{ width: 'auto' }} checked={!!selected[s.product.id]} onChange={(e) => setSelected({ ...selected, [s.product.id]: e.target.checked })} /></td>
                      <td>{s.product.code} - {s.product.name}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatNumber(s.product.stock_actual)}</td>
                      <td>{s.avgDailySales}</td>
                      <td>{s.reorderPoint}</td>
                      <td>{s.daysOfStockRemaining ?? '-'}</td>
                      <td>{s.suggestedQty}</td>
                      <td><input type="number" min="0" style={{ width: 80 }} value={qtyOverride[s.product.id] ?? s.suggestedQty} onChange={(e) => setQtyOverride({ ...qtyOverride, [s.product.id]: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )
      )}

      {tab === 'historial' && (
        <div className="card">
          {history.length === 0 ? <div className="empty-state">Sin historial de sugerencias.</div> : (
            <table>
              <thead><tr><th>Fecha</th><th>Producto</th><th>Prom. Diario</th><th>Lead Time</th><th>Cant. Sugerida</th><th>Estado</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDateTime(h.created_at)}</td>
                    <td>{h.product_code} - {h.product_name}</td>
                    <td>{h.avg_daily_sales}</td>
                    <td>{h.lead_time_days} días</td>
                    <td>{h.suggested_qty}</td>
                    <td><span className="badge badge-muted">{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
