const fs = require("fs");

function generateCustomerGroups(count = 100000) {
  const groups = [];

  for (let i = 1; i <= count; i++) {
    groups.push({
      groupName: `Customer Group ${i}`,
    });
  }

  return {
    groups,
  };
}

// generate data
const data = generateCustomerGroups(100000);

// write to json file
fs.writeFileSync(
  "customer-groups.json",
  JSON.stringify(data, null, 2),
  "utf-8"
);

console.log("✅ customer-groups.json file created with 10,000 groups");
