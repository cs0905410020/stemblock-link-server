const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const JOBS_DIR = path.join(__dirname, "../temp/jobs");

// Allowed firmware extensions
const ALLOWED_EXTENSIONS = [".hex", ".bin", ".uf2"];

function deleteJob(jobId) {
    const jobDir = path.join(JOBS_DIR, jobId);

    setTimeout(() => {
        fs.rm(jobDir, { recursive: true, force: true }, err => {
            if (err) console.error("Cleanup failed:", err);
            else console.log("Deleted job:", jobId);
        });
    }, 15000); // 15 seconds safety delay
}

// 👈 ADD THIS FIRST (handles /download/{jobId}/{filename})
router.get("/:jobId/:filename", (req, res) => {
    const { jobId, filename } = req.params;

    // basic sanitize
    if (!/^[a-zA-Z0-9-_]+$/.test(jobId) || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).json({ error: "Invalid jobId or filename" });
    }
    const ext = path.extname(filename).toLowerCase();
    const targetFolder = (ext === ".py" || ext === ".mpy") ? "fs" : "build";
    const filePath = path.join(JOBS_DIR, jobId, targetFolder, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    // IMPORTANT: do NOT restrict extensions anymore
    // IMPORTANT: do NOT use res.download

    res.sendFile(filePath, err => {
        if (!err) {
            deleteJob(jobId);
        }
    });
});
// Permanent Desktop App Download API
// GET /download/desktop
router.get("/desktop", (req, res) => {
    const DESKTOP_DIR = path.join(__dirname, "../downloads/desktop");

    if (!fs.existsSync(DESKTOP_DIR)) {
        return res.status(404).json({ error: "Desktop builds folder not found" });
    }

    const files = fs.readdirSync(DESKTOP_DIR)
        .filter(file => file.endsWith(".exe"));

    if (files.length === 0) {
        return res.status(404).json({ error: "No desktop build found" });
    }

    // Sort by latest modified time
    const latestFile = files
        .map(file => ({
            name: file,
            time: fs.statSync(path.join(DESKTOP_DIR, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)[0].name;

    const filePath = path.join(DESKTOP_DIR, latestFile);

    // Always download with fixed name
    res.download(filePath, latestFile?.name);
});
/**
 * GET /download/:jobId
 */
router.get("/:jobId", (req, res) => {
    const { jobId } = req.params;

    // Basic sanitization
    if (!/^[a-zA-Z0-9-_]+$/.test(jobId)) {
        return res.status(400).json({ error: "Invalid jobId" });
    }

    const jobDir = path.join(JOBS_DIR, jobId);

    if (!fs.existsSync(jobDir)) {
        return res.status(404).json({ error: "Job not found" });
    }

    // Recursively find firmware file
    let firmwareFile = null;

    function findFirmware(dir) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                findFirmware(fullPath);
                if (firmwareFile) return;
            } else {
                const ext = path.extname(file).toLowerCase();
                if (ALLOWED_EXTENSIONS.includes(ext)) {
                    firmwareFile = fullPath;
                    return;
                }
            }
        }
    }

    findFirmware(jobDir);

    if (!firmwareFile) {
        return res.status(404).json({
            error: "Firmware file not found"
        });
    }

    res.download(firmwareFile, path.basename(firmwareFile));

    res.on("finish", () => {
        deleteJob(jobId);
    });

});
module.exports = router;
