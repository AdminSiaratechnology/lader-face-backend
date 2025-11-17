const express = require("express");
const router = express.Router();
const userManagement = require("../controllers/userManagementControler");
const upload = require("../config/s3");

router.get("/client/allUsers", userManagement.getAllClientUsers);
// router.get('/client/:companyId', userManagement.getAllClientUsersWithCompany);
router.put(
  "/profile/update",
  upload.fields([{ name: "profile", maxCount: 1 }]),
  userManagement.updateUserProfile
);
router.get("/partners", userManagement.getPartners);
router.get("/clients", userManagement.getClients)
router.post("/sendEmail", upload.array("supportingDocuments"),userManagement.sendEmail)
router.get("/insideUsers", userManagement.getSubRoleUsers)
router.post("/request-limit",upload.array("supportingDocuments"), userManagement.requestLimit)
router.get("/limit", userManagement.getPendingLimitRequests)
router.patch("/limit/:userId", userManagement.approveLimitRequest)
router.get("/partners/all", userManagement.getAllPartners);

module.exports = router;
