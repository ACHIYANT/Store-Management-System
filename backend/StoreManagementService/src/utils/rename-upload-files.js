const fs = require("fs");
const path = require("path");

function sanitizeEntryNo(entryNo) {
  return entryNo.replace(/[\/\\]/g, "-"); // CI-2025/1901 → CI-2025-1901
}

function renameUploadedFiles({ entryNo, billNo }) {
  const folders = ["bills", "items"];
  const renamedPaths = {};

  const safeEntryNo = sanitizeEntryNo(entryNo);

  for (const folder of folders) {
    const uploadDir = path.join(__dirname, "..", "uploads", folder);
    if (!fs.existsSync(uploadDir)) continue;

    const files = fs.readdirSync(uploadDir);

    files
      .filter((f) => f.startsWith(`unknown_${billNo}_`))
      .forEach((file) => {
        const newName = file.replace(
          `unknown_${billNo}_`,
          `${safeEntryNo}_${billNo}_`,
        );

        const oldPath = path.join(uploadDir, file);
        const newPath = path.join(uploadDir, newName);

        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }

        // ✅ path saved for DB (relative)
        renamedPaths[folder] = `/uploads/${folder}/${newName}`;
      });
  }

  return renamedPaths;
}

module.exports = { renameUploadedFiles };
