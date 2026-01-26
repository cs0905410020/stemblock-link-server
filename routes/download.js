const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const JOBS_DIR = path.join(__dirname, "../temp/jobs");

// Allowed firmware extensions
const ALLOWED_EXTENSIONS = [".hex", ".bin", ".uf2"];

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
