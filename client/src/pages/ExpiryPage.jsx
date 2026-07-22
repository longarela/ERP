import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate, formatNumber } from '../utils/format';

export default function ExpiryPage() {
  const { hasRole } = useAuth();
  const canDiscard = hasRole('admin', 'gerente');
  const toast = useToast();
  const [tab, setTab] = useState('proximos');
  const [nearExpiry, setNearExpiry] = useState([]);
  const [expired, setExpired] = useState([]);
  const [discarded, setDiscarded] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get('/batches/near-expiry', { params: { days: 30 } }),
      api.get('/batches/expired'),
      api.get('/batches/discarded'),
    ]).then(([n, e, d]) => {
      setNearExpiry(n.data);
      setExpired(e.data);
      setDiscarded(d.data);
    }).finally(() => setLoading(false));
  }
  useEffect(loadAll, []);

  async function handleDiscard(batch) {
    if (!confirm(`¿Descartar ${formatNumber(batch.quantity)} unidades de "${batch.product_name}" (lote ${batch.batch_code || batch.id})?`)) return;
    try {
      await api.post(`/batches/${batch.id}/discard`, { reason: 'Producto vencido - descarte' });
      toast.push('Lote descartado y stock actualizado');
      loadAll();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    }
  }

  return (
    <div>
      <div className="page-header"><h2>Control de Vencimientos</h2></div>
      <div className="tabs">
        <button className={tab === 'proximos' ? 'active' : ''} onClick={() => setTab('proximos')}>Próximos a Vencer ({nearExpiry.length})</button>
        <button className={tab === 'vencidos' ? 'active' : ''} onClick={() => setTab('vencidos')}>Vencidos ({expired.length})</button>
        <button className={tab === 'historial' ? 'active' : ''} onClick={() => setTab('historial')}>Historial de Descartes</button>
      </div>

      {loading ? <div className="empty-state">Cargando...</div> : (
        <div className="card">
          {tab === 'proximos' && (
            nearExpiry.length === 0 ? <div className="empty-state">No hay productos próximos a vencer.</div> : (
              <table>
                <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Vence</th><th>Días restantes</th><th>Alerta</th></tr></thead>
                <tbody>
                  {nearExpiry.map((b) => (
                    <tr key={b.id}>
                      <td>{b.product_code} - {b.product_name}</td>
                      <td>{b.batch_code || '-'}</td>
                      <td>{formatNumber(b.quantity)} {b.unit}</td>
                      <td>{formatDate(b.expiry_date)}</td>
                      <td>{b.days_to_expiry} días</td>
                      <td>
                        <span className={`badge ${b.alert_level <= 7 ? 'badge-danger' : b.alert_level <= 15 ? 'badge-warning' : 'badge-muted'}`}>
                          ≤ {b.alert_level} días
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'vencidos' && (
            expired.length === 0 ? <div className="empty-state">No hay productos vencidos. 🎉</div> : (
              <table>
                <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Venció el</th><th>Días vencido</th>{canDiscard && <th></th>}</tr></thead>
                <tbody>
                  {expired.map((b) => (
                    <tr key={b.id}>
                      <td>{b.product_code} - {b.product_name}</td>
                      <td>{b.batch_code || '-'}</td>
                      <td>{formatNumber(b.quantity)} {b.unit}</td>
                      <td>{formatDate(b.expiry_date)}</td>
                      <td><span className="badge badge-danger">{b.days_expired} días</span></td>
                      {canDiscard && <td><button className="btn btn-sm btn-danger" onClick={() => handleDiscard(b)}>Descartar</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'historial' && (
            discarded.length === 0 ? <div className="empty-state">Sin descartes registrados.</div> : (
              <table>
                <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad descartada</th><th>Fecha</th><th>Motivo</th><th>Usuario</th></tr></thead>
                <tbody>
                  {discarded.map((b) => (
                    <tr key={b.id}>
                      <td>{b.product_code} - {b.product_name}</td>
                      <td>{b.batch_code || '-'}</td>
                      <td>{formatNumber(b.quantity)}</td>
                      <td>{formatDate(b.discarded_at)}</td>
                      <td>{b.discarded_reason || '-'}</td>
                      <td>{b.discarded_by_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  );
}
