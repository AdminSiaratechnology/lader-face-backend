const fs = require("fs");

/**
 * Generate bulk dummy data for any entity
 * @param {Object} options
 * @param {"vendor"|"ledger"|"agent"|"customer"} options.type
 * @param {number} options.count
 * @param {string} options.companyId
 */
function generateBulkDummy({
  type = "vendor",
  count = 10000,
  companyId = "68e4eaba050897a5382286eb",
}) {
  const data = [];

  for (let i = 1; i <= count; i++) {
    const base = {
      company: companyId,
      name: `${capitalize(type)} ${i}`,
      emailAddress: `${type}${i}d@example.com`,
      phoneNumber: `+919${(900000000 + i).toString().padStart(9, "0")}`,
    };

    switch (type) {
      case "vendor":
        data.push({
          ...base,
          name: base.name,

          type: "Supplier",
          group: "Default Vendor Group",
          category: "General",
        });
        break;

      case "ledger":
        data.push({
          ...base,
          company: companyId,
          ledgerName: base.name,
          type: "Asset",
          group: "General Ledger",
        });
        break;

      case "agent":
        data.push({
          ...base,
          type: "Sales Agent",
          group: "Domestic",
        });
        break;

      case "customer":
        data.push({
          ...base,
          type: "Retail",
          group: "Walk-in",
        });
        break;

      default:
        throw new Error("Invalid type");
    }
  }

  return data;
}

// Helper
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// -------------------
// WRITE JSON FILE
// -------------------
const type = process.argv[2] || "vendor"; // vendor | ledger | agent | customer
const count = Number(process.argv[3]) || 10000;

const payloadKeyMap = {
  vendor: "vendors",
  ledger: "ledgers",
  agent: "agents",
  customer: "customers",
};

const payload = {
  [payloadKeyMap[type]]: generateBulkDummy({ type, count }),
};

fs.writeFileSync(
  `${type}-bulk-${count}.json`,
  JSON.stringify(payload, null, 2),
  "utf-8"
);

console.log(`✅ ${type}-bulk-${count}.json generated`);
