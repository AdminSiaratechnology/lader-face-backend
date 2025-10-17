const fs = require('fs');

function generateCustomerData(outputFile, numRecords = 10000) {
  // Base template for the customer data
  const baseTemplate = {
  
    company: "68e4eaba050897a5382286eb" ,
    clientId: "68e4c05943e6b05c02e8f951" ,
    customerType: "company",
    customerStatus: "active",
    status: "Active",
    zipCode: "234567",
    country: "India",
    currency: "INR",
    isFrozenAccount: false,
    disabled: false,
    allowZeroValuation: false,
    isTaxExempt: false,
    reverseCharge: false,
    exportCustomer: false,
    acceptedPaymentMethods: ["[]"],
    banks: [ {
      "accountHolderName": "shsdjj",
      "accountNumber": "387984",
      "ifscCode": "sdbf787",
      "swiftCode": "",
      "micrNumber": "df",
      "bankName": "dgg",
      "branch": "sfd",
      
    }],
    dataSource: "manual",
    customerPriority: "medium",
    allowPartialShipments: false,
    allowBackOrders: false,
    autoInvoice: false,
    logo: "",
    registrationDocs: [],
   
  };

  // Lists for generating varied customer data
  const firstNames = ["Amit", "Priya", "Rahul", "Sneha", "Vikram", "Anjali", "Rohan", "Pooja", "Kiran", "Neha"];
  const lastNames = ["Sharma", "Patel", "Verma", "Singh", "Gupta", "Mehta", "Kumar", "Jain", "Reddy", "Das"];
  const bankNames = ["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak Bank", "Canara Bank", "PNB", "BOB", "Union Bank", "Yes Bank"];
  const branches = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad", "Jaipur", "Surat"];

  // Generate 1000 records
  const records = [];

  for (let i = 0; i < numRecords; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const bankName = bankNames[i % bankNames.length];
    const branch = branches[i % branches.length];

    // Generate unique code (16-digit number)
    const code = `2195${(i + 100000000000).toString().padStart(12, '0')}3`;
    // Generate customer name
    const customerName = `${firstName}${lastName}${i.toString().padStart(3, '0')}3`;
    // Generate contact person
    const contactPerson = `${firstName} ${lastName}`;
    // Generate email address
    const emailAddress = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}3@gmail.com`;
    // Generate account holder name
    const accountHolderName = `${firstName} ${lastName}`;
    // Generate unique account number (8-digit)
    const accountNumber = (387984 + i).toString().padStart(8, '0');
    // Generate unique IFSC code
    const ifscCode = `SDFB${(1000 + i).toString().padStart(4, '0')}`;
    // Generate unique MICR number
    const micrNumber = `MICR${(100 + i).toString().padStart(3, '0')}`;
    // Generate unique _id for record
    const recordId = `68f0878254471209396e${(0x8bc0 + i).toString(16).padStart(4, '0')}`;
    // Generate unique _id for bank
    const bankId = `68f0878254471209396e${(0x8bc1 + i).toString(16).padStart(4, '0')}`;

    // Create record by copying base template and updating variable fields
    const record = {
      ...baseTemplate,
  
      code,
      customerName,
      contactPerson,
      emailAddress,
     
      banks: [{
        ...baseTemplate.banks[0],
        accountHolderName,
        accountNumber,
        ifscCode,
        micrNumber,
        bankName,
        branch,
      }]
    };
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
  const outputFile = "customer_data.json";
  const result = generateCustomerData(outputFile);
  console.log(result);
}

module.exports = generateCustomerData;