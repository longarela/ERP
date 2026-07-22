import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';

const STATUS_LABELS = {
  borrador: 'Borrador', enviado: 'Enviado', recibido_parcial: 'Recibido parcial', recibido: 'Recibido', cancelado: 'Cancelado',
};
const STATUS_BADGE = {
  borrador: 'badge-muted', enviado: 'badge-warning', recibido_parcial: 'badge-warning', recibido: 'badge-success', cancelado: 'badge-danger',
};

export default function PurchaseOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    setLoading(true);
    api.get('/purchase-orders', { params: { status: status || undefined } }).then((res) => setOrders(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [status]);

  async function openDetail(po) {
    const { data } = await api.get(`/purchase-orders/${po.id}`);
    setDetail(data);
  }

  return (
    <div>
      <div className="page-header">
        <h2>Órdenes de Compra</h2>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ Nueva Orden Manual</button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
          <label>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="card">
        {loading ? <div className="empty-state">Cargando...</div> : orders.length === 0 ? (
          <div className="empty-state">No hay órdenes de compra.</div>
        ) : (
          <table>
            <thead><tr><th>N°</th><th>Proveedor</th><th>Estado</th><th>Fecha</th><th>Esperada</th><th></th></tr></thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id}>
                  <td>{po.number}</td>
                  <td>{po.supplier_name}</td>
                  <td><span className={`badge ${STATUS_BADGE[po.status]}`}>{STATUS_LABELS[po.status]}</span></td>
                  <td>{formatDate(po.created_at)}</td>
                  <td>{po.expected_date ? formatDate(po.expected_date) : '-'}</td>
                  <td><button className="btn btn-sm" onClick={() => openDetail(po)}>Ver / Recibir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && <DetailModal po={detail} onClose={() => setDetail(null)} onUpdated={() => { load(); setDetail(null); }} />}
      {createOpen && <CreateOrderModal onClose={() => setCreateOpen(false)} onCreated={() => { load(); setCreateOpen(false); }} />}
    </div>
  );
}

function DetailModal({ po, onClose, onUpdated }) {
  const toast = useToast();
  const [receiving, setReceiving] = useState(false);
  const [received, setReceived] = useState(() => {
    const obj = {};
    po.items.forEach((i) => { obj[i.id] = { quantity: i.quantity_ordered - i.quantity_received, expiryDate: '', batchCode: '' }; });
    return obj;
  });
  const canReceive = po.status !== 'recibido' && po.status !== 'cancelado';

  async function handleReceive() {
    const items = Object.entries(received)
      .map(([itemId, v]) => ({ itemId: Number(itemId), quantity: Number(v.quantity || 0), expiryDate: v.expiryDate || null, batchCode: v.batchCode || null }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) { toast.push('Indique alguna cantidad a recibir', 'error'); return; }
    const missingExpiry = items.find((i) => {
      const poItem = po.items.find((x) => x.id === i.itemId);
      return poItem?.track_expiry && !i.expiryDate;
    });
    if (missingExpiry) { toast.push('Debe indicar fecha de vencimiento para productos que la requieren', 'error'); return; }
    setReceiving(true);
    try {
      await api.post(`/purchase-orders/${po.id}/receive`, { items });
      toast.push('Recepción registrada, stock actualizado');
      onUpdated();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setReceiving(false);
    }
  }

  return (
    <Modal title={`Orden ${po.number} - ${po.supplier_name}`} onClose={onClose} width={700}>
      <table>
        <thead>
          <tr><th>Producto</th><th>Pedido</th><th>Recibido</th><th>Costo</th>{canReceive && <th>Recibir ahora</th>}{canReceive && <th>Vencimiento</th>}</tr>
        </thead>
        <tbody>
          {po.items.map((item) => (
            <tr key={item.id}>
              <td>{item.product_code} - {item.product_name}</td>
              <td>{formatNumber(item.quantity_ordered)}</td>
              <td>{formatNumber(item.quantity_received)}</td>
              <td>{formatCurrency(item.unit_cost)}</td>
              {canReceive && (
                <td>
                  <input
                    type="number" min="0" style={{ width: 70 }}
                    value={received[item.id]?.quantity ?? ''}
                    onChange={(e) => setReceived({ ...received, [item.id]: { ...received[item.id], quantity: e.target.value } })}
                  />
                </td>
              )}
              {canReceive && (
                <td>
                  {item.track_expiry && (
                    <input
                      type="date"
                      value={received[item.id]?.expiryDate ?? ''}
                      onChange={(e) => setReceived({ ...received, [item.id]: { ...received[item.id], expiryDate: e.target.value } })}
                    />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cerrar</button>
        {canReceive && <button className="btn btn-primary" disabled={receiving} onClick={handleReceive}>{receiving ? 'Procesando...' : 'Confirmar Recepción'}</button>}
      </div>
    </Modal>
  );
}

function CreateOrderModal({ onClose, onCreated }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitCost: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then((res) => setSuppliers(res.data));
    api.get('/products').then((res) => setProducts(res.data));
  }, []);

  function updateItem(idx, patch) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addRow() { setItems((prev) => [...prev, { productId: '', quantity: 1, unitCost: 0 }]); }
  function removeRow(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleSubmit(e) {
    e.preventDefault();
    const valid = items.filter((i) => i.productId && Number(i.quantity) > 0);
    if (!supplierId || valid.length === 0) { toast.push('Complete proveedor y al menos un producto', 'error'); return; }
    setSaving(true);
    try {
      const { data: po } = await api.post('/purchase-orders', {
        supplierId,
        items: valid.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: Number(i.unitCost || 0) })),
      });
      toast.push(`Orden ${po.number} creada`);
      onCreated();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nueva Orden de Compra" onClose={onClose} width={600}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Proveedor *</label>
          <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Seleccione...</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Producto</label>
              <select value={item.productId} onChange={(e) => {
                const p = products.find((x) => String(x.id) === e.target.value);
                updateItem(idx, { productId: e.target.value, unitCost: p ? p.cost_price : 0 });
              }}>
                <option value="">Seleccione...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ width: 80, marginBottom: 0 }}>
              <label>Cant.</label>
              <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
            </div>
            <div className="field" style={{ width: 100, marginBottom: 0 }}>
              <label>Costo unit.</label>
              <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => updateItem(idx, { unitCost: e.target.value })} />
            </div>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRow(idx)}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={addRow}>+ Agregar producto</button>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear Orden'}</button>
        </div>
      </form>
    </Modal>
  );
}
