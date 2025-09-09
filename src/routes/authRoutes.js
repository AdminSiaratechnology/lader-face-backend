const router = require('express').Router();
const { register, login } = require('../controllers/authController');


router.post('/register', register); // SuperAdmin/Partner can create users for their org via separate UI rules
router.post('/login', login);


module.exports = router;
