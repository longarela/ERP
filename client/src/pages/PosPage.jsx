import { useEffect, useMemo, useRef, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency } from '../utils/format';
import { printReceipt } from '../utils/receipt';

function computeLine(item) {
  const gross = Math.max(0, item.unitPrice * item.qty - item.discount);
  const net = gross / (1 + item.ivaRate / 100);
  const tax = gross - net;
  return { gross, net, tax };
}

export default function PosPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [businessName, setBusinessName] = useState('ERP POS');
  const [submitting, setSubmitting] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data));
    api.get('/settings').then((res) => setBusinessName(res.data.business_name || 'ERP POS'));
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(() => {
      api.get('/products', { params: { search } }).then((res) => setResults(res.data.slice(0, 12)));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function addToCart(product) {
    if (product.available_stock <= 0) {
      toast.push(`"${product.name}" no tiene stock disponible (vencido o agotado)`, 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty + 1 > product.available_stock) {
          toast.push(`Stock disponible insuficiente para "${product.name}"`, 'error');
          return prev;
        }
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, {
        productId: product.id,
        code: product.code,
        name: product.name,
        unitPrice: product.sale_price,
        ivaRate: product.iva_rate,
        qty: 1,
        discount: 0,
        availableStock: product.available_stock,
      }];
    });
    setSearch('');
    setResults([]);
    searchInputRef.current?.focus();
  }

  function updateQty(productId, qty) {
    setCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i;
      const clamped = Math.max(1, Math.min(qty, i.availableStock));
      return { ...i, qty: clamped };
    }));
  }
  function updateDiscount(productId, discount) {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, discount: Math.max(0, discount) } : i)));
  }
  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const item of cart) {
      const { net, tax: t } = computeLine(item);
      subtotal += net;
      tax += t;
    }
    const total = Math.max(0, subtotal + tax - Number(globalDiscount || 0));
    return { subtotal, tax, total };
  }, [cart, globalDiscount]);

  const change = paymentMethod === 'efectivo' ? Math.max(0, Number(amountPaid || 0) - totals.total) : 0;
  const canSubmit = cart.length > 0 && (paymentMethod !== 'efectivo' || Number(amountPaid || 0) >= totals.total);

  async function handleCheckout() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: sale } = await api.post('/sales', {
        items: cart.map((i) => ({ productId: i.productId, quantity: i.qty, unitPrice: i.unitPrice, discount: i.discount })),
        customerId: customerId || null,
        paymentMethod,
        amountPaid: paymentMethod === 'efectivo' ? Number(amountPaid) : totals.total,
        discountTotal: Number(globalDiscount || 0),
      });
      toast.push(`Venta ${sale.number} registrada con éxito`);
      printReceipt(sale, businessName);
      setCart([]);
      setGlobalDiscount(0);
      setAmountPaid('');
      setCustomerId('');
    } catch (err) {
      toast.push(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pos-layout">
      <div>
        <div className="page-header"><h2>Punto de Venta</h2></div>
        <div className="card" style={{ marginBottom: 16 }}>
          <input
            ref={searchInputRef}
            placeholder="Buscar por código, nombre o código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {results.length > 0 && (
            <div className="pos-search-results" style={{ marginTop: 8 }}>
              {results.map((p) => (
                <div key={p.id} className="pos-product-row" onClick={() => addToCart(p)}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code} · Stock disp.: {p.available_stock}</div>
                  </div>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(p.sale_price)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Carrito ({cart.length})</h3>
          {cart.length === 0 ? (
            <div className="empty-state">Busque productos para agregarlos a la venta.</div>
          ) : (
            <div>
              {cart.map((item) => {
                const { gross } = computeLine(item);
                return (
                  <div key={item.productId} className="cart-item">
                    <div className="name">
                      <div>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatCurrency(item.unitPrice)} c/u · IVA {item.ivaRate}%</div>
                    </div>
                    <input
                      type="number" min="1" max={item.availableStock}
                      value={item.qty}
                      onChange={(e) => updateQty(item.productId, Number(e.target.value))}
                    />
                    <input
                      type="number" min="0" title="Descuento en $"
                      style={{ width: 70 }}
                      value={item.discount}
                      onChange={(e) => updateDiscount(item.productId, Number(e.target.value))}
                    />
                    <div style={{ width: 90, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(gross)}</div>
                    <button className="btn btn-sm btn-danger" onClick={() => removeItem(item.productId)}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ marginTop: 0 }}>Cobro</h3>
        <div className="field">
          <label>Cliente (opcional)</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Consumidor Final</option>
            {customers.filter((c) => c.name !== 'Consumidor Final').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Descuento total ($)</label>
          <input type="number" min="0" value={globalDiscount} onChange={(e) => setGlobalDiscount(e.target.value)} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>IVA</span><span>{formatCurrency(totals.tax)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
            <span>Total</span><span>{formatCurrency(totals.total)}</span>
          </div>
        </div>

        <div className="field">
          <label>Método de pago</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="debito">Tarjeta de Débito</option>
            <option value="credito">Tarjeta de Crédito</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>

        {paymentMethod === 'efectivo' && (
          <div className="field">
            <label>Importe recibido</label>
            <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            {Number(amountPaid || 0) >= totals.total && totals.total > 0 && (
              <div style={{ marginTop: 6, fontSize: 14 }}>Vuelto: <strong>{formatCurrency(change)}</strong></div>
            )}
          </div>
        )}

        <button className="btn btn-primary" disabled={!canSubmit || submitting} onClick={handleCheckout} style={{ marginTop: 'auto' }}>
          {submitting ? 'Procesando...' : `Cobrar ${formatCurrency(totals.total)}`}
        </button>
      </div>
    </div>
  );
}
