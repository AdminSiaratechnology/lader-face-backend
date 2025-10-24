const fs = require('fs');
const crypto=require("crypto")
const generate16DigitId = () =>
  (BigInt("0x" + crypto.randomBytes(8).toString("hex")) % (10n ** 16n))
    .toString()
    .padStart(16, "0");

function generateAgentData(outputFile, numRecords = 1000) {
  // Base template for the agent data
  const baseTemplate = {
   
    company: "68e4e4e92011a526432708d9",
    clientId: "68e4c05943e6b05c02e8f951",
    agentType: "individual",
    agentStatus: "active",
    status: "Active",
    currency: "INR",
    isTaxExempt: false,
    reverseCharge: false,
    acceptedPaymentMethods: ["[\"[\\\"[]\\\"]\""],
    banks: [],
    dataSource: "manual",
    agentPriority: "medium",
    logo: "",
    registrationDocs: [],
    createdBy: "68e4c14343e6b05c02e8f954",
    performanceRating: 0,
    activeContracts: 0
  };

  // Lists for generating varied agent data
  const firstNames = ["Amit", "Priya", "Rahul", "Sneha", "Vikram", "Anjali", "Rohan", "Pooja", "Kiran", "Neha"];
  const lastNames = ["Sharma", "Patel", "Verma", "Singh", "Gupta", "Mehta", "Kumar", "Jain", "Reddy", "Das"];
  const designations = ["Agent", "Manager", "Consultant", "Broker", "Representative", "Advisor", "Coordinator"];
  const cities = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad", "Jaipur", "Surat"];
  const states = ["Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "West Bengal", "Telangana", "Maharashtra", "Gujarat", "Rajasthan", "Gujarat"];
  const addressPrefixes = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const addressAreas = ["Sector", "Colony", "Nagar", "Vihar", "Puram", "Enclave", "Park", "Road", "Lane", "Block"];

  // Generate 1000 records
  const records = [];

  for (let i = 0; i < numRecords; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const city = cities[i % cities.length];
    const state = states[i % states.length];
    const designation = designations[i % designations.length];
    const addressPrefix = addressPrefixes[i % addressPrefixes.length];
    const addressArea = addressAreas[i % addressAreas.length];

    // Generate unique agentName
    const agentName = `${firstName} ${lastName}1`;
    // Generate unique shortName
    const shortName = `${firstName}${lastName}${i.toString().padStart(3, '0')}1`;
    // Generate unique contactPerson
    const contactPerson = agentName;
    // Generate unique designation
    const uniqueDesignation = `${designation} ${i + 1}`;
    // Generate unique phoneNumber
    const phoneNumber = `+919${(973884720 + i).toString().padStart(9, '0')}`;
    // Generate unique emailAddress
    const emailAddress = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}1@gmail.com`;
    // Generate unique addressLine1
    const addressLine1 = `${addressPrefix}${i % 10} ${addressArea} ${city}`.toLowerCase();
    // Generate unique zipCode
    const zipCode = (110094 + i).toString().padStart(6, '0');
    const code=generate16DigitId()

    // Create record by copying base template and updating variable fields
    const record = {
      ...baseTemplate,
      agentName,
      shortName,
      contactPerson,
      designation: uniqueDesignation,
      phoneNumber,
      emailAddress,
      addressLine1,
      city,
      state,
      zipCode,
      code
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
  const outputFile = "agent_data.json";
  const result = generateAgentData(outputFile);
  console.log(result);
}

module.exports = generateAgentData;