const fs = require("fs");
const crypto = require("crypto");

const generate16DigitId = () =>
  (BigInt("0x" + crypto.randomBytes(8).toString("hex")) % (10n ** 16n))
    .toString()
    .padStart(16, "0");

function generateVendorData(outputFile, numRecords = 1000) {
  const baseTemplate = {
    company: "68e4eaba050897a5382286eb",
    clientId: "68e4c05943e6b05c02e8f951",
    vendorType: "company",
    status: "Active",
    dataSource: "manual",
    currency: "INR",
    isTaxExempt: false,
    reverseCharge: false,
    exportVendor: false,
    acceptedPaymentMethods: ["[]"],
    banks: [],
    registrationDocs: [],
    logo: "",
    allowPartialShipments: false,
    allowBackOrders: false,
    autoInvoice: false,
    vendorPriority: "medium",
    isFrozenAccount: false,
    disabled: false,
    allowZeroValuation: false,
  };

  // Randomized field data
  const vendorGroups = ["distributor", "wholesaler", "retailer", "service_provider"];
  const industryTypes = ["manufacturing", "services", "technology", "logistics"];
  const territories = ["north", "south", "east", "west"];
  const companySizes = ["small", "medium", "enterprise"];
  const vendorStatuses = ["active", "inactive", "suspended"];

  const firstNames = ["Amit", "Neha", "Vikas", "Anjali", "Rohan", "Sneha", "Vivek", "Priya", "Rahul", "Pooja"];
  const lastNames = ["Sharma", "Patel", "Verma", "Singh", "Gupta", "Kumar", "Reddy", "Das", "Mehta", "Jain"];
  const cities = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune", "Jaipur", "Surat", "Ahmedabad"];
  const states = ["Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "West Bengal", "Telangana", "Rajasthan", "Gujarat"];
  const taxCategories = ["standard", "reduced", "exempt"];
  const taxTemplates = ["standard_tax", "reduced_tax"];
  const withholdingTaxCategories = ["tds_commission", "tds_contract", "tds_professional"];
  const paymentTermsList = ["net_15", "net_30", "net_45"];
  const priceLists = ["standard", "premium", "discounted"];

  const records = [];

  for (let i = 0; i < numRecords; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const city = cities[i % cities.length];
    const state = states[i % states.length];
    const vendorGroup = vendorGroups[i % vendorGroups.length];
    const industryType = industryTypes[i % industryTypes.length];
    const territory = territories[i % territories.length];
    const companySize = companySizes[i % companySizes.length];
    const vendorStatus = vendorStatuses[i % vendorStatuses.length];
    const taxCategory = taxCategories[i % taxCategories.length];
    const taxTemplate = taxTemplates[i % taxTemplates.length];
    const withholdingTaxCategory = withholdingTaxCategories[i % withholdingTaxCategories.length];
    const paymentTerms = paymentTermsList[i % paymentTermsList.length];
    const priceList = priceLists[i % priceLists.length];

    const vendorName = `${firstName} ${lastName} Pvt Ltd`;
    const shortName = `${firstName}${lastName}${i}`;
    const procurementPerson = `${firstName} ${lastName}`;
    const contactPerson = `${firstName} ${lastName}`;
    const designation = "Manager";
    const phoneNumber = `+9198${(Math.floor(Math.random() * 90000000) + 10000000)}`;
    const mobileNumber = `+9197${(Math.floor(Math.random() * 90000000) + 10000000)}`;
    const emailAddress = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`;
    const addressLine1 = `Plot No. ${i + 10}, ${city} Industrial Area`;
    const addressLine2 = `Building ${String.fromCharCode(65 + (i % 26))}`;
    const zipCode = (110000 + i).toString().padStart(6, "0");
    const website = `https://${firstName.toLowerCase()}${lastName.toLowerCase()}${i}.com`;
    const taxId = `${1000 + i}`;
    const vatNumber = `VAT${2000 + i}`;
    const gstNumber = `GST${3000 + i}`;
    const panNumber = `PAN${4000 + i}`;
    const tanNumber = `TAN${5000 + i}`;
    const msmeRegistration = `MSME${6000 + i}`;
    const creditLimit = (Math.floor(Math.random() * 100000) + 5000).toString();
    const creditDays = (15 + (i % 60)).toString();
    const discount = (5 + (i % 30)).toString();
    const agent = "operations";
    const code = generate16DigitId();

    const banks = [
      {
        accountHolderName: `${firstName} ${lastName}`,
        accountNumber: `AC${100000 + i}`,
        ifscCode: `IFSC${2000 + i}`,
        swiftCode: `SWFT${i}`,
        micrNumber: `MICR${3000 + i}`,
        bankName: "State Bank of India",
        branch: city,
      },
    ];

    const record = {
      ...baseTemplate,
      code,
      vendorName,
      shortName,
      vendorGroup,
      industryType,
      territory,
      procurementPerson,
      vendorStatus,
      companySize,
      contactPerson,
      designation,
      phoneNumber,
      mobileNumber,
      emailAddress,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      country: "India",
      website,
      priceList,
      paymentTerms,
      creditLimit,
      creditDays,
      discount,
      agent,
      taxId,
      vatNumber,
      gstNumber,
      panNumber,
      tanNumber,
      taxCategory,
      taxTemplate,
      withholdingTaxCategory,
      msmeRegistration,
      banks,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    records.push(record);
  }

  try {
    fs.writeFileSync(outputFile, JSON.stringify(records, null, 2));
    return `✅ Generated ${numRecords} vendor records and saved to ${outputFile}`;
  } catch (error) {
    return `❌ Error writing to file: ${error.message}`;
  }
}

// Example usage
if (require.main === module) {
  const outputFile = "vendor_data.json";
  const result = generateVendorData(outputFile);
  console.log(result);
}

module.exports = generateVendorData;
