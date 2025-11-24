module.exports = function generateThermalInvoice(order, company) {

  // ============================
  //  ITEMS TABLE
  // ============================
  const itemsHTML = order.items
    .map((item, index) => {
      const unitRate = item.price;
      const itemValue = item.taxableValue;
      const netAmount = item.total;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${item?.productId?.ItemName || item?.name}</td>
          ${company.country === "India" ? `<td>${item?.hsnCode ? item.hsnCode : "-"}</td>` : ""}
          <td>${item.quantity}</td>
          <td>${unitRate.toFixed(2)}</td>
          <td>${itemValue.toFixed(2)}</td>
          <td>${item.taxPercentage}%</td>
          <td>${netAmount.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");


  // ============================
  //   TAX GROUP (RATE WISE)
  // ============================
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
      console.log("rowwwtaxGroupHTML===", row, "rate", rate);

      // Foreign
      if (company.country !== "India") {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${rate}%</td>
            <td>${row.taxable.toFixed(2)}</td>
            <td>-</td>
            <td>-</td>
            <td>${row.totalTax.toFixed(2)}</td>
          </tr>
        `;
      }

      // IGST
      if (company.isIGST) {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${rate}%</td>
            <td>${row.taxable.toFixed(2)}</td>
            <td>${row.totalTax.toFixed(2)}</td>
            <td>-</td>
            <td>${row.totalTax.toFixed(2)}</td>
          </tr>
        `;
      }

      // CGST + SGST
      const halfTax = row.totalTax / 2;
      console.log("halfTax", halfTax, row, "rowwwwwww");
      const halfTaxable = row.taxable / 2;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${rate}%</td>
          <td>${row.taxable.toFixed(2)}</td>
          <td>${halfTax.toFixed(2)}</td>
          <td>${halfTax.toFixed(2)}</td>
          <td>${row.totalTax.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");


  // ============================
  //   HSN SUMMARY
  // ============================
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

  const hsnSummaryHTML = Object.keys(hsnGroup)
    .map((hsn, index) => {
      const row = hsnGroup[hsn];

      const half = row.tax / 2;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${hsn === "NO-HSN" ? "-" : hsn}</td>
          <td>${row.rate}%</td>
          <td>${row.taxable.toFixed(2)}</td>
          ${
            company.country !== "India"
              ? `<td>-</td><td>-</td>`
              : company.isIGST
              ? `<td>${row.tax.toFixed(2)}</td><td>-</td>`
              : `<td>${half.toFixed(2)}</td><td>${half.toFixed(2)}</td>`
          }
          <td>${row.tax.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");


  // ============================
  //   HTML OUTPUT
  // ============================
  return `
  <html>
    <head>
      <style>
        body { font-family: monospace; width: 500px; }
        h2,h3,p { text-align: center; margin: 0; }
        table {  font-size: 12px; }
        .center { text-align: center; }
        hr { border-top: 1px dashed #000; margin: 5px 0; }
        td ,table { border: 1px solid #000; border-collapse: collapse; padding: 4px; }
      </style>
    </head>

    <body style="width: 500px; padding: 10px; border: 1px solid #000; background: ;">

      <h2>${company.namePrint}</h2>
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

      <hr>

      <p><b>TAX INVOICE</b></p>
      <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
      <p>Invoice No: ${order.orderCode}</p>
      <hr>
      <h3 style="text-align:left; margin-top:5px;">Bill To:</h3>
<p style="text-align:left; margin:0;">
  Name: ${order.customerId.customerName || "John Doe"}<br>
  Mobile: ${order.customerId.phoneNumber || "9999999999"}<br>
  Address: ${order.customerId.addressLine1 || "123 Dummy Street"}<br>
  City: ${order.customerId.city || ""}, 
  State: ${order.customerId.state || "MH"}<br>
  Pincode: ${order.customerId.zipCode || "400001"}<br>
  ${order.customerGst ? `GSTIN: ${order.customerGst}` : ""}
</p>

<hr>

      <!-- ITEMS TABLE -->
      <table>
        <tr>
          <th>Sr</th>
          <th>Item</th>
          ${company.country === "India" ? `<th>HSN</th>` : ""}
          <th>Qty</th>
          <th>Rate</th>
          <th>Value</th>
          <th>${company.country === "India" ? "GST" : "VAT"}</th>
          <th>Net</th>
        </tr>
        ${itemsHTML}
      </table>

      <hr>

      <!-- TAX SUMMARY -->
      <h3>Tax Summary</h3>
      <table>
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
          <th>Total</th>
        </tr>
        ${taxGroupHTML}
      </table>

      <hr>

      <!-- HSN SUMMARY -->
      <h3>HSN Summary</h3>
      <table>
        <tr>
          <th>Sr</th>
          <th>HSN</th>
          <th>Rate</th>
          <th>Taxable</th>
          <th>CGST/IGST</th>
          <th>SGST</th>
          <th>Total Tax</th>
        </tr>
        ${hsnSummaryHTML}
      </table>

      <hr>

      <h3>Total: Rs. ${order?.grandTotal?.toFixed(2)}</h3>
      <p class="center">Thank You Visit Again!</p>

    </body>
  </html>
  `;
};