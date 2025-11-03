async function processRegistrationDocs(files, rawDocTypes) {
  if (!files.length) return [];
  const docTypes = JSON.parse(rawDocTypes || "[]");
  return Promise.all(
    files.map((file, index) => ({
      type: docTypes[index] || "Other",
      file: file.location,
      fileName: file.originalname,
    }))
  );
}
module.exports = processRegistrationDocs;
