import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [backing, setBacking] = useState(false);

  useEffect(() => { api.get('/settings').then((res) => setSettings(res.data)); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/settings', settings);
      setSettings(data);
      toast.push('Configuración guardada');
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleBackup() {
    setBacking(true);
    try {
      const { data } = await api.post('/backup');
      toast.push(`Respaldo creado: ${data.file.split('/').pop()}`);
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setBacking(false);
    }
  }

  if (!settings) return <div className="empty-state">Cargando...</div>;

  return (
    <div>
      <div className="page-header"><h2>Configuración</h2></div>
      <form onSubmit={handleSave} className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <div className="field">
          <label>Nombre del negocio</label>
          <input value={settings.business_name || ''} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>IVA por defecto (%)</label>
            <input type="number" min="0" step="0.1" value={settings.default_iva || ''} onChange={(e) => setSettings({ ...settings, default_iva: e.target.value })} />
          </div>
          <div className="field">
            <label>Moneda</label>
            <input value={settings.currency || ''} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Umbrales de alerta de vencimiento (días, separados por coma)</label>
          <input value={settings.near_expiry_thresholds_days || ''} onChange={(e) => setSettings({ ...settings, near_expiry_thresholds_days: e.target.value })} placeholder="30,15,7" />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Período de revisión de pedidos (días)</label>
            <input type="number" min="1" value={settings.reorder_review_period_days || ''} onChange={(e) => setSettings({ ...settings, reorder_review_period_days: e.target.value })} />
          </div>
          <div className="field">
            <label>Factor de seguridad (Z)</label>
            <input type="number" min="0" step="0.05" value={settings.reorder_safety_z || ''} onChange={(e) => setSettings({ ...settings, reorder_safety_z: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Configuración'}</button>
      </form>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Respaldo de Base de Datos</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          El sistema realiza un respaldo automático todos los días a las 3:00 AM (se conservan los últimos 30).
          También puede generar uno manualmente ahora.
        </p>
        <button className="btn" onClick={handleBackup} disabled={backing}>{backing ? 'Generando...' : 'Generar Respaldo Ahora'}</button>
      </div>
    </div>
  );
}
