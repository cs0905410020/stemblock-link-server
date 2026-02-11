const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const JOBS_DIR = path.join(__dirname, "../temp/jobs");

// Allowed firmware extensions
const ALLOWED_EXTENSIONS = [".hex", ".bin", ".uf2"];

// 👈 ADD THIS FIRST (handles /download/{jobId}/{filename})
router.get("/:jobId/:filename", (req, res) => {
    const { jobId, filename } = req.params;

    // Sanitize
    if (!/^[a-zA-Z0-9-_]+$/.test(jobId) || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).json({ error: "Invalid jobId or filename" });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({ error: "Invalid file extension" });
    }

    const filePath = path.join(JOBS_DIR, jobId, 'build',filename);
console.log(filePath);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, filename, err => {
        if (err) {
            console.error("Download error:", err);
            if (!res.headersSent) res.status(500).json({ error: "Download failed" });
        }
    });
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

    res.download(firmwareFile, path.basename(firmwareFile), err => {
        if (err) {
            console.error("Download error:", err);
            if (!res.headersSent) {
                res.status(500).json({ error: "Download failed" });
            }
        }
    });
});
module.exports = router;
