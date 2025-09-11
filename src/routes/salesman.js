const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Company = require('../models/Company');

// Assign salesman to a company with access
router.post('/assign', async (req, res) => {
  try {
    const { salesmanId, companyId, modules } = req.body;

    const salesman = await User.findById(salesmanId);
    const company = await Company.findById(companyId);

    if (!salesman || !company) {
      return res.status(404).json({ message: "Salesman or Company not found" });
    }

    if (salesman.role !== 'Salesman') {
      return res.status(400).json({ message: "User is not a salesman" });
    }

    // Check if already assigned
    const existingAccess = salesman.access.find(a => a.company.toString() === companyId);
    if (existingAccess) {
      return res.status(400).json({ message: "Salesman already assigned to this company" });
    }

    // Add access
    salesman.access.push({
      company: companyId,
      modules
    });

    await salesman.save();

    res.json({ message: "Salesman assigned to company successfully", salesman });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get salesman access
router.get('/:salesmanId/access', async (req, res) => {
  try {
    const salesman = await User.findById(req.params.salesmanId)
      .populate('access.company', 'namePrint email');

    if (!salesman) return res.status(404).json({ message: "Salesman not found" });

    res.json({ access: salesman.access });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
