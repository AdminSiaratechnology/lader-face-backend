function checkPermission(module, subModule, action) {
  return (req, res, next) => {
    try {
      const user = req.user; // JWT se decoded user
      const companyId = req.params.companyId || req.body.companyId;

      // ✅ 1. Check if allPermissions is true
      if (user.allPermissions) {
        return next(); // sab allowed
      }

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const companyAccess = user.access.find(
        (acc) => acc.company.toString() === companyId.toString()
      );

      if (!companyAccess) {
        return res.status(403).json({ error: "No access to this company" });
      }

      const modulePermissions = companyAccess.modules[module]?.[subModule];

      if (!modulePermissions) {
        return res.status(403).json({ error: "No access to this module/submodule" });
      }

      if (modulePermissions[action] === true) {
        return next();
      }

      if (Array.isArray(modulePermissions.extra) && modulePermissions.extra.includes(action)) {
        return next();
      }

      return res.status(403).json({ error: "Action not allowed" });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
}
