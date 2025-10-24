const fs = require('fs');

function generateRandomString(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomEmail(index) {
  const domains = ['example.com', 'mail.com', 'test.com', 'company.com'];
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  return `user${index}_${generateRandomString(3)}@${randomDomain}`;
}

function generateCompanies(count = 1000) {
  const cities = ['Kolkata', 'Mumbai', 'Delhi', 'Chennai', 'Bengaluru'];
  const states = ['West Bengal', 'Maharashtra', 'Delhi', 'Tamil Nadu', 'Karnataka'];
  const companies = [];

  for (let i = 1; i <= count; i++) {
    const cityIndex = Math.floor(Math.random() * cities.length);

    const company = {
      namePrint: `${generateRandomString(6)} 1Inc`,
      banks: '[]',
      addressLine1: `${Math.floor(Math.random() * 1000) + 1} ${generateRandomString(8)} 1Street`,
      city: cities[cityIndex],
      state: states[cityIndex],
      zipCode: `${Math.floor(100000 + Math.random() * 900000)}`, // random 6-digit zip
      country: 'India',
      currency: 'INR',
      email: `a${generateRandomEmail(i)}`, // unique email
    };

    companies.push(company);
  }

  return companies;
}

// Generate 1000 companies
const data = generateCompanies(1000);

// Write to local JSON file
fs.writeFile('companies.json', JSON.stringify(data, null, 2), (err) => {
  if (err) {
    console.error('Error writing file', err);
  } else {
    console.log('companies.json file successfully created with', data.length, 'companies');
  }
});
