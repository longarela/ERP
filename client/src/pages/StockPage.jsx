import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateTime, formatNumber } from '../utils/format';

const TYPE_LABELS = {
  compra: 'Compra', devolucion_cliente: 'Devolución de cliente', venta: 'Venta',
  ajuste_positivo: 'Ajuste (+)', ajuste_negativo: 'Ajuste (-)', perdida: 'Pérdida',
  descarte_vencido: 'Descarte por vencimiento', devolucion_proveedor: 'Devolución a proveedor',
};

export default function StockPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'gerente');
  const [tab, setTab] = useState('movimientos');

  return (
    <div>
      <div className="page-header"><h2>Stock y Movimientos</h2></div>
      <div className="tabs">
        <button className={tab === 'movimientos' ? 'active' : ''} onClick={() => setTab('movimientos')}>Historial</button>
        {canEdit && <button className={tab === 'entrada' ? 'active' : ''} onClick={() => setTab('entrada')}>Registrar Entrada</button>}
        {canEdit && <button className={tab === 'ajuste' ? 'active' : ''} onClick={() => setTab('ajuste')}>Ajuste Manual</button>}
        {canEdit && <button className={tab === 'perdida' ? 'active' : ''} onClick={() => setTab('perdida')}>Registrar Pérdida</button>}
      </div>
      {tab === 'movimientos' && <MovementsTab />}
      {tab === 'entrada' && canEdit && <EntryForm />}
      {tab === 'ajuste' && canEdit && <AdjustmentForm />}
      {tab === 'perdida' && canEdit && <LossForm />}
    </div>
  );
}

function MovementsTab() {
  const [movements, setMovements] = useState([]);
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/stock/movements', { params: { type: type || undefined, from: from || undefined, to: to || undefined } })
      .then((res) => setMovements(res.data))
      .finally(() => setLoading(false));
  }
  useEffect(load, [type, from, to]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <a className="btn btn-sm" href={`/api/reports/movements.csv?type=${type}&from=${from}&to=${to}`} target="_blank" rel="noreferrer">Exportar CSV</a>
      </div>
      <div className="card">
        {loading ? <div className="empty-state">Cargando...</div> : movements.length === 0 ? (
          <div className="empty-state">Sin movimientos para el filtro seleccionado.</div>
        ) : (
          <table>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Usuario</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.created_at)}</td>
                  <td>{m.product_code} - {m.product_name}</td>
                  <td><span className={`badge ${m.quantity >= 0 ? 'badge-success' : 'badge-danger'}`}>{TYPE_LABELS[m.type] || m.type}</span></td>
                  <td>{m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity)}</td>
                  <td>{m.reason || '-'}</td>
                  <td>{m.user_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function useProducts() {
  const [products, setProducts] = useState([]);
  useEffect(() => { api.get('/products').then((res) => setProducts(res.data)); }, []);
  return products;
}

function ProductSelect({ value, onChange, products }) {
  return (
    <select required value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleccione un producto...</option>
      {products.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name} (stock: {formatNumber(p.stock_actual)})</option>)}
    </select>
  );
}

function EntryForm() {
  const toast = useToast();
  const products = useProducts();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [reason, setReason] = useState('Ingreso de mercadería');
  const [saving, setSaving] = useState(false);
  const selected = products.find((p) => String(p.id) === String(productId));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/stock/entry', {
        productId, quantity: Number(quantity), unitCost: unitCost ? Number(unitCost) : undefined,
        expiryDate: expiryDate || null, batchCode: batchCode || null, reason,
      });
      toast.push('Entrada de mercadería registrada');
      setProductId(''); setQuantity(''); setUnitCost(''); setExpiryDate(''); setBatchCode('');
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <form onSubmit={handleSubmit}>
        <div className="field"><label>Producto *</label><ProductSelect value={productId} onChange={setProductId} products={products} /></div>
        <div className="form-grid">
          <div className="field"><label>Cantidad *</label><input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <div className="field"><label>Costo unitario</label><input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder={selected ? selected.cost_price : ''} /></div>
        </div>
        {selected?.track_expiry ? (
          <div className="form-grid">
            <div className="field"><label>Fecha de vencimiento *</label><input required type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
            <div className="field"><label>Código de lote</label><input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} /></div>
          </div>
        ) : null}
        <div className="field"><label>Motivo / referencia</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Registrar Entrada'}</button>
      </form>
    </div>
  );
}

function AdjustmentForm() {
  const toast = useToast();
  const products = useProducts();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [direction, setDirection] = useState('positivo');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) { toast.push('Debe indicar una justificación', 'error'); return; }
    setSaving(true);
    try {
      const signedQty = direction === 'positivo' ? Number(quantity) : -Number(quantity);
      await api.post('/stock/adjustment', { productId, quantity: signedQty, reason });
      toast.push('Ajuste registrado');
      setProductId(''); setQuantity(''); setReason('');
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <form onSubmit={handleSubmit}>
        <div className="field"><label>Producto *</label><ProductSelect value={productId} onChange={setProductId} products={products} /></div>
        <div className="form-grid">
          <div className="field">
            <label>Tipo de ajuste</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="positivo">Sumar stock (+)</option>
              <option value="negativo">Restar stock (-)</option>
            </select>
          </div>
          <div className="field"><label>Cantidad *</label><input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        </div>
        <div className="field"><label>Justificación *</label><textarea required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: diferencia detectada en conteo físico" /></div>
        <button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Registrar Ajuste'}</button>
      </form>
    </div>
  );
}

function LossForm() {
  const toast = useToast();
  const products = useProducts();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) { toast.push('Debe indicar el motivo de la pérdida', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/stock/loss', { productId, quantity: Number(quantity), reason });
      toast.push('Pérdida registrada');
      setProductId(''); setQuantity(''); setReason('');
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <form onSubmit={handleSubmit}>
        <div className="field"><label>Producto *</label><ProductSelect value={productId} onChange={setProductId} products={products} /></div>
        <div className="field"><label>Cantidad *</label><input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        <div className="field"><label>Motivo *</label><textarea required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: rotura, robo, daño por humedad" /></div>
        <button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Guardando...' : 'Registrar Pérdida'}</button>
      </form>
    </div>
  );
}
