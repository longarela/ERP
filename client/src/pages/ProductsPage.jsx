import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';
import { formatCurrency, formatNumber } from '../utils/format';

const emptyForm = {
  code: '', barcode: '', name: '', description: '', categoryId: '', supplierId: '',
  unit: 'unidad', costPrice: 0, salePrice: 0, ivaRate: 21, stockMin: 0, trackExpiry: false, imageUrl: '',
};

export default function ProductsPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const canEdit = hasRole('admin', 'gerente');
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(params.get('lowStock') === 'true');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    setLoading(true);
    try {
      const { data } = await api.get('/products', {
        params: { search: search || undefined, categoryId: categoryId || undefined, lowStock: lowStockOnly ? 'true' : undefined },
      });
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data));
    api.get('/suppliers').then((res) => setSuppliers(res.data));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, lowStockOnly]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }
  function openEdit(p) {
    setEditing(p);
    setForm({
      code: p.code, barcode: p.barcode || '', name: p.name, description: p.description || '',
      categoryId: p.category_id || '', supplierId: p.supplier_id || '', unit: p.unit,
      costPrice: p.cost_price, salePrice: p.sale_price, ivaRate: p.iva_rate, stockMin: p.stock_min,
      trackExpiry: !!p.track_expiry, imageUrl: p.image_url || '',
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, form);
        toast.push('Producto actualizado');
      } else {
        await api.post('/products', form);
        toast.push('Producto creado');
      }
      setModalOpen(false);
      loadProducts();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(p) {
    if (!confirm(`¿Desactivar "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.push('Producto desactivado');
      loadProducts();
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Productos</h2>
        {canEdit && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo Producto</button>}
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <label>Buscar</label>
          <input placeholder="Código, nombre o código de barras" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 180, marginBottom: 0 }}>
          <label>Categoría</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={lowStockOnly} onChange={(e) => { setLowStockOnly(e.target.checked); setParams(e.target.checked ? { lowStock: 'true' } : {}); }} />
          Solo stock bajo mínimo
        </label>
      </div>

      <div className="card">
        {loading ? <div className="empty-state">Cargando...</div> : products.length === 0 ? (
          <div className="empty-state">No se encontraron productos.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th><th>Nombre</th><th>Categoría</th><th>Stock</th><th>Mínimo</th>
                <th>Precio Venta</th><th>Vencimiento</th><th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{p.category_name || '-'}</td>
                  <td style={{ color: p.stock_actual <= p.stock_min ? 'var(--danger)' : 'inherit', fontWeight: p.stock_actual <= p.stock_min ? 600 : 400 }}>
                    {formatNumber(p.stock_actual)}
                  </td>
                  <td>{formatNumber(p.stock_min)}</td>
                  <td>{formatCurrency(p.sale_price)}</td>
                  <td>{p.track_expiry ? <span className="badge badge-warning">Sí</span> : <span className="badge badge-muted">No</span>}</td>
                  <td>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(p)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(p)}>Desactivar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canEdit && modalOpen && (
        <Modal title={editing ? 'Editar Producto' : 'Nuevo Producto'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="field">
                <label>Código *</label>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="field">
                <label>Código de barras</label>
                <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Nombre *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Categoría</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Proveedor</label>
                <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Precio de Costo</label>
                <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </div>
              <div className="field">
                <label>Precio de Venta *</label>
                <input required type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
              </div>
              <div className="field">
                <label>IVA %</label>
                <select value={form.ivaRate} onChange={(e) => setForm({ ...form, ivaRate: e.target.value })}>
                  <option value="0">0%</option>
                  <option value="10.5">10.5%</option>
                  <option value="21">21%</option>
                  <option value="27">27%</option>
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Unidad</label>
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="field">
                <label>Stock Mínimo</label>
                <input type="number" min="0" value={form.stockMin} onChange={(e) => setForm({ ...form, stockMin: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>URL de imagen (opcional)</label>
              <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.trackExpiry} onChange={(e) => setForm({ ...form, trackExpiry: e.target.checked })} />
              Este producto requiere control de vencimiento (por lotes)
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
