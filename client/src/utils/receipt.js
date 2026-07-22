import { formatCurrency, formatDateTime } from './format';

export function printReceipt(sale, businessName) {
  const win = window.open('', '_blank', 'width=380,height=600');
  if (!win) return;
  const rows = sale.items.map((it) => `
    <tr>
      <td>${it.quantity} x ${it.product_name || it.name}</td>
      <td style="text-align:right">${formatCurrency(it.unit_price * it.quantity - (it.discount || 0))}</td>
    </tr>
  `).join('');

  win.document.write(`
    <html>
    <head>
      <title>Comprobante ${sale.number}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 12px; color: #000; }
        h2 { text-align: center; margin: 4px 0; font-size: 16px; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        td { padding: 2px 0; }
        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .totals td { font-weight: bold; }
        .right { text-align: right; }
      </style>
    </head>
    <body onload="window.print()">
      <h2>${businessName || 'ERP POS'}</h2>
      <div class="center">Comprobante N° ${sale.number}</div>
      <div class="center">${formatDateTime(sale.created_at)}</div>
      <hr />
      <table>${rows}</table>
      <hr />
      <table class="totals">
        <tr><td>Subtotal</td><td class="right">${formatCurrency(sale.subtotal)}</td></tr>
        <tr><td>IVA</td><td class="right">${formatCurrency(sale.tax_total)}</td></tr>
        ${sale.discount_total ? `<tr><td>Descuento</td><td class="right">-${formatCurrency(sale.discount_total)}</td></tr>` : ''}
        <tr><td>TOTAL</td><td class="right">${formatCurrency(sale.total)}</td></tr>
      </table>
      <hr />
      <table>
        <tr><td>Forma de pago</td><td class="right">${sale.payment_method}</td></tr>
        <tr><td>Pagado</td><td class="right">${formatCurrency(sale.amount_paid)}</td></tr>
        ${sale.change_given ? `<tr><td>Vuelto</td><td class="right">${formatCurrency(sale.change_given)}</td></tr>` : ''}
      </table>
      <hr />
      <div class="center">¡Gracias por su compra!</div>
    </body>
    </html>
  `);
  win.document.close();
}
