import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { formatCurrency, formatDateTime } from '../utils/format';

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', taxId: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);

  function load() {
    api.get('/customers', { params: { search: search || undefined } }).then((res) => setCustomers(res.data));
  }
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [search]);

  function openCreate() { setEditing(null); setForm({ name: '', taxId: '', phone: '', email: '', address: '' }); setModalOpen(true); }
  function openEdit(c) {
    setEditing(c);
    setForm({ name: c.name, taxId: c.tax_id || '', phone: c.phone || '', email: c.email || '', address: c.address || '' });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/customers/${editing.id}`, form);
      else await api.post('/customers', form);
      toast.push('Cliente guardado');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(c) {
    const { data } = await api.get(`/customers/${c.id}/history`);
    setHistory({ customer: c, sales: data });
  }

  return (
    <div>
      <div className="page-header">
        <h2>Clientes</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo Cliente</button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <input placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card">
        {customers.length === 0 ? <div className="empty-state">Sin clientes.</div> : (
          <table>
            <thead><tr><th>Nombre</th><th>CUIT/DNI</th><th>Teléfono</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.tax_id || '-'}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => openHistory(c)}>Historial</button>
                    <button className="btn btn-sm" onClick={() => openEdit(c)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar Cliente' : 'Nuevo Cliente'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave}>
            <div className="field"><label>Nombre *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>CUIT/DNI</label><input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></div>
            <div className="form-grid">
              <div className="field"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="field"><label>Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {history && (
        <Modal title={`Historial de ${history.customer.name}`} onClose={() => setHistory(null)} width={600}>
          {history.sales.length === 0 ? <div className="empty-state">Sin compras registradas.</div> : (
            <table>
              <thead><tr><th>N°</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
              <tbody>
                {history.sales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.number}</td>
                    <td>{formatDateTime(s.created_at)}</td>
                    <td>{formatCurrency(s.total)}</td>
                    <td><span className={`badge ${s.status === 'anulada' ? 'badge-danger' : 'badge-success'}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}
