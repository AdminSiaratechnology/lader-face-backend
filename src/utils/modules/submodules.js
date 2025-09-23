const modulesConfig = require('./modulesConfig');

function defaultPermission() {
  return { create: false, read: false, update: false, delete: false, extra: [] };
}

/**
 * user: mongoose document or lean() object
 */
function ensureUserPermissions(user) {
  if (!user || user.allPermissions) return user;

  user.access = user.access || [];

  user.access.forEach(acc => {
    acc.modules = acc.modules || new Map();

    Object.entries(modulesConfig).forEach(([moduleName, subModules]) => {
      if (!acc.modules.has(moduleName)) acc.modules.set(moduleName, new Map());

      const subMap = acc.modules.get(moduleName);

      subModules.forEach(sub => {
        if (!subMap.has(sub)) subMap.set(sub, defaultPermission());
      });

      acc.modules.set(moduleName, subMap);
    });
  });

  return user;
}

module.exports = { ensureUserPermissions, defaultPermission };
