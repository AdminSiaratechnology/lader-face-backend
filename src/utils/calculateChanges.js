module.exports = function calculateChanges(oldData, newData) {
  const changes = {};

  for (const key of Object.keys(newData)) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changes[key] = {
        old: oldData[key],
        new: newData[key],
      };
    }
  }

  return changes;
};
