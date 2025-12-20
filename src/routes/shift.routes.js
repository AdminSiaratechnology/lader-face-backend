const express = require("express");

const { closeShift } = require("../controllers/shiftController");
const router = express.Router();

router.post("/close",closeShift);

module.exports = router;