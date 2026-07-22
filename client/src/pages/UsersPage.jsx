import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { formatDate } from '../utils/format';

const emptyForm = { username: '', password: '', fullName: '', role: 'vendedor' };

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() { api.get('/users').then((res) => setUsers(res.data)); }
  useEffect(load, []);

  function openCreate() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(u) { setEditing(u); setForm({ username: u.username, password: '', fullName: u.full_name, role: u.role }); setModalOpen(true); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, { fullName: form.fullName, role: form.role, password: form.password || undefined });
      } else {
        await api.post('/users', form);
      }
      toast.push('Usuario guardado');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    try {
      await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
      load();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Usuarios</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo Usuario</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.full_name}</td>
                <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                <td><span className={`badge ${u.active ? 'badge-success' : 'badge-muted'}`}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
                <td>{formatDate(u.created_at)}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => openEdit(u)}>Editar</button>
                  <button className="btn btn-sm" onClick={() => toggleActive(u)}>{u.active ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar Usuario' : 'Nuevo Usuario'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave}>
            <div className="field">
              <label>Usuario *</label>
              <input required disabled={!!editing} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="field">
              <label>Nombre completo *</label>
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="field">
              <label>Rol *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="vendedor">Vendedor</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="field">
              <label>{editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
              <input required={!editing} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
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
