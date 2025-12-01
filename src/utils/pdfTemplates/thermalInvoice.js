module.exports = function generateDynamicInvoice(order, company, formatType) {

  const getStyles = (format) => {
    const f = format.toLowerCase();
    
    // 1. Base Styles: Flexbox on body forces the .container to be centered
    let css = `
      body { 
        font-family: 'Helvetica', 'Arial', sans-serif; 
        padding: 0; 
        margin: 0;
        display: flex;           /* Flexbox for centering */
        justify-content: center; /* Horizontally center content */
        width: 100%;
      }
      .container {
        box-sizing: border-box;  /* Padding doesn't increase width */
      }
      h2, h3, p { margin: 0; }
      .center { text-align: center; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #000; padding: 4px; text-align: left; }
      hr { border-top: 1px dashed #000; margin: 10px 0; }
      .text-right { text-align: right; }
    `;

    // 2. Specific Format Widths
    if (f === 'a4') {
      return css + `
        .container { 
            width: 95%;           /* Leave a small gap on sides */
            max-width: 210mm;     /* Max A4 width */
            font-size: 14px; 
            padding: 20px; 
        }
        h2 { font-size: 24px; text-align: center; }
        table { font-size: 14px; }
      `;
    } else if (f === 'a5') {
      return css + `
        .container { 
            width: 95%; 
            max-width: 148mm;
            font-size: 12px; 
            padding: 10px; 
        }
        h2 { font-size: 20px; text-align: center; }
        table { font-size: 11px; }
      `;
    } else if (f === '80mm') {
      return css + `
        .container { 
            width: 100%;        /* Fill the 80mm paper */
            max-width: 78mm;    /* Safe zone */
            font-family: monospace; 
            font-size: 11px; 
        }
        h2 { font-size: 16px; text-align: center; }
        td, th { padding: 2px; }
        table { font-size: 10px; }
      `;
    } else if (f === '58mm') {
      return css + `
        .container { 
            width: 100%;
            max-width: 56mm; 
            font-family: monospace; 
            font-size: 10px; 
        }
        h2 { font-size: 14px; text-align: center; }
        td, th { padding: 1px; font-size: 9px; }
      `;
    } else {
      // Fallback (Custom fixed width centered)
      return css + `
        .container { 
            width: 500px; 
            margin: 0 auto; 
            font-family: monospace; 
            font-size: 12px; 
        }
        h2 { text-align: center; }
      `;
    }
  };

  // ... [Items Table, Tax Group, HSN Group Logic remains the same as before] ...
  // (Copy logic from previous response here if needed, omitted for brevity)
  
  // --- ITEMS TABLE LOGIC ---
  const isSmall = formatType.toLowerCase() === '58mm';
  
  const itemsHTML = order.items
    .map((item, index) => {
      const unitRate = item.price;
      const itemValue = item.taxableValue;
      const netAmount = item.total;
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${item?.productId?.ItemName || item?.name}</td>
          ${!isSmall && company.country === "India" ? `<td>${item?.hsnCode ? item.hsnCode : "-"}</td>` : ""}
          <td>${item.quantity}</td>
          <td>${unitRate.toFixed(2)}</td>
          ${!isSmall ? `<td>${itemValue.toFixed(2)}</td>` : ""}
          ${!isSmall ? `<td>${item.taxPercentage}%</td>` : ""}
          <td class="text-right">${netAmount.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  // --- TAX GROUP LOGIC ---
  const taxGroup = order.items.reduce((acc, item) => {
    const rate = item.taxPercentage;
    if (!acc[rate]) acc[rate] = { taxable: 0, totalTax: 0 };
    acc[rate].taxable += item.taxableValue;
    acc[rate].totalTax += item.taxAmount;
    return acc;
  }, {});

  const taxGroupHTML = Object.keys(taxGroup)
    .map((rate, index) => {
      const row = taxGroup[rate];
      let taxCols = '';
      if (company.country !== "India") {
        taxCols = `<td>-</td><td>-</td>`;
      } else if (company.isIGST) {
        taxCols = `<td>${row.totalTax.toFixed(2)}</td><td>-</td>`;
      } else {
        const halfTax = row.totalTax / 2;
        taxCols = `<td>${halfTax.toFixed(2)}</td><td>${halfTax.toFixed(2)}</td>`;
      }
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${rate}%</td>
          <td>${row.taxable.toFixed(2)}</td>
          ${taxCols}
          <td class="text-right">${row.totalTax.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  // --- HSN LOGIC ---
  const hsnGroup = order.items.reduce((acc, item) => {
    const hsn = item.hsnCode || "NO-HSN";
    const rate = item.taxPercentage;
    const taxable = item.taxableValue;
    const tax = item.taxAmount;
    if (!acc[hsn]) acc[hsn] = { taxable: 0, rate, tax: 0 };
    acc[hsn].taxable += taxable;
    acc[hsn].tax += tax;
    return acc;
  }, {});
  const {street="",line2="",city="",state="",postalCode="",country=""} =order?.shippingAddress



  // ============================
  //   HTML OUTPUT
  // ============================
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${getStyles(formatType)}
      </style>
    </head>

    <body>
      <div class="container">
        
        <h2>${company.namePrint}</h2>
        <div class="center">
          <p>${company.address1} ${company.address2 ? ", " + company.address2 : ""} 
             ${company.city ? ", " + company.city : ""} 
             ${company.state ? ", " + company.state : ""} 
             ${company.pincode ? ", " + company.pincode : ""}</p>

          ${
            company.country === "India"
              ? company.gstNumber
                ? `<p>GSTIN: ${company.gstNumber}</p>`
                : ""
              : company.vatNumber
              ? `<p>VATIN: ${company.vatNumber}</p>`
              : ""
          }
                   <p>INVOICE No: ${order.orderCode}</p>
        </div>

        <hr>

        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
               
                <p>Order Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
                <p>Print Date: ${new Date().toLocaleDateString()}</p>
            </div>
            
            ${formatType.toLowerCase() === 'a4' || formatType.toLowerCase() === 'a5' ? `
            <div style="text-align:right">
               <p>${order.customerId.customerName || "Customer"}</p>
               <p>${order.customerId.phoneNumber || ""}</p>
               ${order.customerGst ? `<p>GST: ${order.customerGst}</p>` : ""}
                <p>${state|| ""}</p>
                <p>${city|| ""}</p>
                <p>${postalCode|| ""}</p>
                
               
            </div>
            ` : ''} 
        </div>

        ${formatType.toLowerCase() !== 'a4' && formatType.toLowerCase() !== 'a5' ? `
        <h3 style="margin-top:5px;">Bill To:</h3>
        <p>
          ${order.customerId.customerName || "Customer"}<br>
          ${order.customerId.phoneNumber ? order.customerId.phoneNumber + '<br>' : ""}
          ${order.customerId.addressLine1 || ""}<br>
        </p>
        ` : ''}

        <hr>

        <table>
          <thead>
            <tr>
              <th width="5%">Sr</th>
              <th width="30%">Item</th>
              ${!isSmall && company.country === "India" ? `<th>HSN</th>` : ""}
              <th>Qty</th>
              <th>Rate</th>
              ${!isSmall ? `<th>Value</th>` : ""}
              ${!isSmall ? `<th>Tax%</th>` : ""}
              <th class="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <hr>

        <h3>Tax Summary</h3>
        <table>
          <thead>
            <tr>
              <th>Sr</th>
              <th>Rate</th>
              <th>Taxable</th>
              ${
                company.country !== "India"
                  ? `<th>-</th><th>-</th>`
                  : company.isIGST
                  ? `<th>IGST</th><th>-</th>`
                  : `<th>CGST</th><th>SGST</th>`
              }
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${taxGroupHTML}
          </tbody>
        </table>

        <br>

    ${company.country === "India" ? 
        `<h3>HSN Summary</h3>
        <table>
           <thead>
             <tr>
               <th>HSN</th>
               <th>Taxable</th>
               <th>Tax</th>
             </tr>
           </thead>
           <tbody>
             ${Object.keys(hsnGroup).map(hsn => `
                <tr>
                   <td>${hsn}</td>
                   <td>${hsnGroup[hsn].taxable.toFixed(2)}</td>
                   <td>${hsnGroup[hsn].tax.toFixed(2)}</td>
                </tr>
             `).join('')}
           </tbody>
        </table>`
        : ""}

        <hr>

        <h3 style="text-align:right; font-size: ${formatType === 'A4' ? '20px' : '16px'}">
            Total: Rs. ${order?.grandTotal?.toFixed(2)}
        </h3>
        
        <br>
        <p class="center">Thank You, Visit Again!</p>
      </div>
    </body>
  </html>
  `;
};