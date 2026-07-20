const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const JOBS_DIR = path.join(__dirname, "../temp/jobs");
const DESKTOP_DIR = path.join(__dirname, "../downloads/desktop");

const ALLOWED_EXTENSIONS = [".hex", ".bin", ".uf2"];
const ALLOWED_FS_EXTENSIONS = [".py", ".mpy"];
const JOB_CLEANUP_DELAY_MS = 10 * 60 * 1000;

function deleteJob(jobId) {
    const jobDir = path.join(JOBS_DIR, jobId);

    setTimeout(() => {
        fs.rm(jobDir, { recursive: true, force: true }, err => {
            if (err) console.error("Cleanup failed:", err);
            else console.log("Deleted job:", jobId);
        });
    }, JOB_CLEANUP_DELAY_MS);
}

/* ---------- DESKTOP ROUTES FIRST ---------- */

// GET /download/desktop/files
router.get("/desktop/files", (req, res) => {
    if (!fs.existsSync(DESKTOP_DIR)) {
        return res.status(404).json({ error: "Desktop builds folder not found" });
    }

    const files = fs.readdirSync(DESKTOP_DIR)
        .filter(file => file.endsWith(".exe"))
        .map(file => {
            const stats = fs.statSync(path.join(DESKTOP_DIR, file));
            return {
                name: file,
                modifiedTime: stats.mtime
            };
        })
        .sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

    if (files.length === 0) {
        return res.status(404).json({ error: "No desktop builds found" });
    }

    res.json(files);
});

// GET /download/desktop/download/:filename
router.get("/desktop/download/:filename", (req, res) => {
    const safeFilename = path.basename(req.params.filename);

    if (!fs.existsSync(DESKTOP_DIR)) {
        return res.status(404).json({ error: "Desktop builds folder not found" });
    }

    if (!safeFilename.endsWith(".exe")) {
        return res.status(400).json({ error: "Invalid file type" });
    }

    const filePath = path.join(DESKTOP_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, safeFilename);
});

// GET /download/desktop
router.get("/desktop", (req, res) => {
    if (!fs.existsSync(DESKTOP_DIR)) {
        return res.status(404).json({ error: "Desktop builds folder not found" });
    }

    const files = fs.readdirSync(DESKTOP_DIR)
        .filter(file => file.endsWith(".exe"));

    if (files.length === 0) {
        return res.status(404).json({ error: "No desktop build found" });
    }

    const latestFile = files
        .map(file => ({
            name: file,
            time: fs.statSync(path.join(DESKTOP_DIR, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)[0].name;

    const filePath = path.join(DESKTOP_DIR, latestFile);

    res.download(filePath, latestFile);
});

/* ---------- JOB ROUTES AFTER ---------- */

function sendJobFile(req, res, jobId, filename) {
    if (!/^[a-zA-Z0-9-_]+$/.test(jobId) || !/^[a-zA-Z0-9._/-]+$/.test(filename)) {
        return res.status(400).json({ error: "Invalid jobId or filename" });
    }

    const ext = path.extname(filename).toLowerCase();
    const targetFolder = ALLOWED_FS_EXTENSIONS.includes(ext) ? "fs" : "build";
    const baseDir = path.join(JOBS_DIR, jobId, targetFolder);
    const filePath = path.join(baseDir, filename);
    const relativePath = path.relative(baseDir, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(filePath, err => {
        if (!err) deleteJob(jobId);
    });
}

// GET /download/:jobId/:filename
router.get("/:jobId/:filename", (req, res) => {
    const { jobId, filename } = req.params;

    sendJobFile(req, res, jobId, filename);
});

// GET /download/:jobId/*
router.get("/:jobId/*", (req, res) => {
    sendJobFile(req, res, req.params.jobId, req.params[0]);
});

// GET /download/:jobId
router.get("/:jobId", (req, res) => {
    const { jobId } = req.params;

    if (!/^[a-zA-Z0-9-_]+$/.test(jobId)) {
        return res.status(400).json({ error: "Invalid jobId" });
    }

    const jobDir = path.join(JOBS_DIR, jobId);

    if (!fs.existsSync(jobDir)) {
        return res.status(404).json({ error: "Job not found" });
    }

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
        return res.status(404).json({ error: "Firmware file not found" });
    }

    res.download(firmwareFile, path.basename(firmwareFile));

    res.on("finish", () => {
        deleteJob(jobId);
    });
});

module.exports = router;
