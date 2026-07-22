import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';

export default function CatalogPage() {
  const [tab, setTab] = useState('categorias');
  return (
    <div>
      <div className="page-header"><h2>Categorías y Proveedores</h2></div>
      <div className="tabs">
        <button className={tab === 'categorias' ? 'active' : ''} onClick={() => setTab('categorias')}>Categorías</button>
        <button className={tab === 'proveedores' ? 'active' : ''} onClick={() => setTab('proveedores')}>Proveedores</button>
      </div>
      {tab === 'categorias' ? <CategoriesTab /> : <SuppliersTab />}
    </div>
  );
}

function CategoriesTab() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  function load() { api.get('/categories').then((res) => setCategories(res.data)); }
  useEffect(load, []);

  function openCreate() { setEditing(null); setForm({ name: '', description: '' }); setModalOpen(true); }
  function openEdit(c) { setEditing(c); setForm({ name: c.name, description: c.description || '' }); setModalOpen(true); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/categories/${editing.id}`, form);
      else await api.post('/categories', form);
      toast.push('Categoría guardada');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c) {
    if (!confirm(`¿Eliminar categoría "${c.name}"?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.push('Categoría eliminada');
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={openCreate}>+ Nueva Categoría</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Nombre</th><th>Descripción</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.description || '-'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => openEdit(c)}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalOpen && (
        <Modal title={editing ? 'Editar Categoría' : 'Nueva Categoría'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave}>
            <div className="field"><label>Nombre *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Descripción</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SuppliersTab() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', leadTimeDays: 7 });
  const [saving, setSaving] = useState(false);

  function load() { api.get('/suppliers').then((res) => setSuppliers(res.data)); }
  useEffect(load, []);

  function openCreate() { setEditing(null); setForm({ name: '', contactName: '', phone: '', email: '', leadTimeDays: 7 }); setModalOpen(true); }
  function openEdit(s) {
    setEditing(s);
    setForm({ name: s.name, contactName: s.contact_name || '', phone: s.phone || '', email: s.email || '', leadTimeDays: s.lead_time_days });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post('/suppliers', form);
      toast.push('Proveedor guardado');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(s) {
    if (!confirm(`¿Desactivar proveedor "${s.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.push('Proveedor desactivado');
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo Proveedor</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Lead Time</th><th></th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>{s.name}{!s.active && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Inactivo</span>}</td>
                <td>{s.contact_name || '-'}</td>
                <td>{s.phone || '-'}</td>
                <td>{s.email || '-'}</td>
                <td>{s.lead_time_days} días</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => openEdit(s)}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(s)}>Desactivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalOpen && (
        <Modal title={editing ? 'Editar Proveedor' : 'Nuevo Proveedor'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave}>
            <div className="field"><label>Nombre *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Persona de contacto</label><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div className="form-grid">
              <div className="field"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="field"><label>Lead time (días para recibir pedido)</label><input type="number" min="0" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} /></div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
