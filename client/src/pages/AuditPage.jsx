import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDateTime } from '../utils/format';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/audit', { params: { entity: entity || undefined, from: from || undefined, to: to || undefined } })
      .then((res) => setLogs(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [entity, from, to]);

  return (
    <div>
      <div className="page-header"><h2>Auditoría del Sistema</h2></div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Entidad</label>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">Todas</option>
            <option value="product">Productos</option>
            <option value="sale">Ventas</option>
            <option value="user">Usuarios</option>
            <option value="product_batch">Lotes</option>
            <option value="purchase_order">Órdenes de Compra</option>
            <option value="settings">Configuración</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}><label>Desde</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Hasta</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="card">
        {loading ? <div className="empty-state">Cargando...</div> : logs.length === 0 ? (
          <div className="empty-state">Sin registros de auditoría.</div>
        ) : (
          <table>
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>ID</th><th>Detalles</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{formatDateTime(l.created_at)}</td>
                  <td>{l.username || '-'}</td>
                  <td>{l.action}</td>
                  <td>{l.entity}</td>
                  <td>{l.entity_id || '-'}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.details}>{l.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
