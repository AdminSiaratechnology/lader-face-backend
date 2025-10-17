const fs = require('fs');

function generateProductData(outputFile, numRecords = 10000) {
  // Base template for the product data
  const baseTemplate = {
    clientId: "68e4c05943e6b05c02e8f951" ,
    companyId: "68e4eaba050897a5382286eb" ,
    status: "Active",
    stockGroup:  "68ecca8f48e1bfde248666b6" ,
    stockCategory:  "68eddda99925db787e39fdfd" ,
    batch: false,
    unit:  "68ecce5d48e1bfde248666fe" ,
    alternateUnit: "68ecce5d48e1bfde248666fe" ,
    minimumQuantity: 100,
    defaultSupplier: "Tech Suppliers Inc",
    minimumRate: 1000000,
    maximumRate: 99999999,
    defaultGodown:  "68ecc8ba48e1bfde248666a4" ,
    productType: "select",
    openingQuantities: []
  };

  // Lists for generating varied product data
  const brands = ["Apple", "Samsung", "Google", "Oppo", "Xiaomi", "Vivo", "Sony", "Huawei", "Nokia", "Motorola"];
  const models = ["iPhone", "Galaxy", "Pixel", "Find", "Mi", "X", "Xperia", "Mate", "G", "Edge"];
  const versions = ["Pro", "Ultra", "", "Plus", "Lite"];
  const storages = ["128GB", "256GB", "512GB", "1TB"];

  // Generate 1000 records
  const records = [];
  let partNoBase = 123121;

  for (let i = 0; i < numRecords; i++) {
    const brand = brands[i % brands.length];
    const model = models[i % models.length];
    const version = versions[i % versions.length];
    const storage = storages[i % storages.length];

    // Generate unique code using full sequential number
    const code = `${brand.slice(0, 3).toUpperCase()}${model[0]}${i.toString().padStart(4, '0')}${version[0] || ''}-${storage.slice(0, 3)}1`;
    // Generate name
    const name = `${brand} ${model} ${version} ${storage}`.trim();
    // Generate unique partNo
    const partNo = (partNoBase + i).toString();

    // Create record by copying base template and updating variable fields
    const record = { ...baseTemplate, code, name, partNo };
    records.push(record);
  }

  // Write to JSON file
  try {
    fs.writeFileSync(outputFile, JSON.stringify(records, null, 2));
    return `Generated ${numRecords} records and saved to ${outputFile}`;
  } catch (error) {
    return `Error writing to file: ${error.message}`;
  }
}

// Example usage
if (require.main === module) {
  const outputFile = "product_data.json";
  const result = generateProductData(outputFile);
  console.log(result);
}

module.exports = generateProductData;