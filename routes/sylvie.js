const express = require("express");
const path = require("path");
const fs = require("fs");

const {
    SylvieUploadManager,
    getProfileById,
    deviceResponse,
    classifySylvieError
} = require(process.env.STEMBLOCK_SYLVIE_UPLOAD_MODULE ||
    path.resolve(__dirname, "..", "..", "stemblock-link", "src", "upload", "sylvie"));

const router = express.Router();

const ARDUINO_CLI = process.env.STEMBLOCK_ARDUINO_CLI_PATH ||
    "/var/www/html/stemblock-link/toolchains/arduino-cli/arduino-cli";
const ARDUINO_CONFIG = process.env.STEMBLOCK_ARDUINO_CONFIG_PATH ||
    "/var/www/html/stemblock-link/toolchains/arduino-cli/arduino-cli.yaml";
const JOBS_ROOT = path.join(__dirname, "../temp/jobs");
const CACHE_FILE = path.join(__dirname, "../temp/sylvie-profile-cache.json");

const createLogSink = logs => event => {
    logs.push(event);
    console.log("[sylvie]", event);
};

const createManager = (logs, body = {}) => new SylvieUploadManager({
    arduinoCliPath: ARDUINO_CLI,
    arduinoConfigPath: ARDUINO_CONFIG,
    jobsRoot: JOBS_ROOT,
    arduinoCwd: path.dirname(ARDUINO_CLI),
    cacheFile: CACHE_FILE,
    portReleaseDelayMs: 400,
    extraProfiles: body.boardProfiles || body.profiles,
    maxSyncAttemptsPerProfile: 2,
    onLog: createLogSink(logs)
});

const portInfoFromBody = body => Object.assign({}, body.portInfo || {}, {
    path: (body.portInfo && body.portInfo.path) || body.port || body.path,
    name: body.portName || body.port
});

const downloadUrlForHex = (jobDir, hexPath) => {
    const jobId = path.basename(jobDir);
    const buildDir = path.join(jobDir, "build");
    const relativeHexFile = path.relative(buildDir, hexPath).replace(/\\/g, "/");
    return `/stemblock/download/${jobId}/${relativeHexFile}`;
};

const localHexPathFromRequest = body => {
    if (body.localHexPath && fs.existsSync(body.localHexPath)) return body.localHexPath;
    const hexPath = String(body.hexPath || "");
    const match = hexPath.match(/\/stemblock\/download\/([^/]+)\/(.+)$/);
    if (match) return path.join(JOBS_ROOT, match[1], "build", match[2]);
    return hexPath;
};

router.get("/ports", async (req, res) => {
    const logs = [];
    try {
        const ports = await createManager(logs).listPorts();
        res.json({success: true, ports, logs});
    } catch (error) {
        res.status(500).json(Object.assign(classifySylvieError(error), {logs}));
    }
});

router.post("/detect", async (req, res) => {
    const logs = [];
    try {
        const manager = createManager(logs, req.body);
        const result = await manager.withPortLock(portInfoFromBody(req.body), async portInfo => {
            if (req.body.forceDetect || req.body.redetect) await manager.removeCachedBoardProfile(portInfo);
            const detected = await manager.resolveSylvieProfile(portInfo, {forceDetect: true});
            return {
                success: true,
                device: deviceResponse(detected.profile, "detect", detected.signature)
            };
        });
        res.json(Object.assign(result, {logs}));
    } catch (error) {
        res.status(500).json(Object.assign(classifySylvieError(error), {logs}));
    }
});

router.post("/verify", async (req, res) => {
    const logs = [];
    try {
        const manager = createManager(logs, req.body);
        const result = await manager.withPortLock(portInfoFromBody(req.body), async portInfo => {
            const profile = req.body.profileId ?
                getProfileById(req.body.profileId) :
                ((await manager.getCachedBoardProfile(portInfo)) || {}).profile;
            const verified = profile ? await manager.verifyBoardProfile(portInfo, profile) : null;
            return {
                success: Boolean(verified),
                device: verified ? deviceResponse(profile, "cache", verified.signature) : null
            };
        });
        res.json(Object.assign(result, {logs}));
    } catch (error) {
        res.status(500).json(Object.assign(classifySylvieError(error), {logs}));
    }
});

router.post("/cache/clear", async (req, res) => {
    const logs = [];
    try {
        const result = await createManager(logs, req.body).removeCachedBoardProfile(portInfoFromBody(req.body));
        res.json(Object.assign(result, {logs}));
    } catch (error) {
        res.status(500).json(Object.assign(classifySylvieError(error), {logs}));
    }
});

router.post("/compile", async (req, res) => {
    const logs = [];
    try {
        const manager = createManager(logs, req.body);
        const result = await manager.withPortLock(portInfoFromBody(req.body), async portInfo => {
            const resolved = req.body.profileId ?
                {profile: getProfileById(req.body.profileId), source: "manual"} :
                await manager.resolveSylvieProfile(portInfo, {
                    forceDetect: Boolean(req.body.forceDetect || req.body.redetect)
                });
            if (!resolved.profile) throw new Error("Unsupported Sylvie profile");
            const compiled = await manager.compileSketch(req.body.sourceCode || req.body.code, resolved.profile);
            return {
                success: true,
                jobId: path.basename(compiled.jobDir),
                type: "avr",
                hexPath: downloadUrlForHex(compiled.jobDir, compiled.hexPath),
                localHexPath: compiled.hexPath,
                device: deviceResponse(resolved.profile, resolved.source, resolved.signature)
            };
        });
        res.json(Object.assign(result, {logs}));
    } catch (error) {
        res.status(500).json(Object.assign(classifySylvieError(error), {logs}));
    }
});

router.post("/upload", async (req, res) => {
    const logs = [];
    try {
        const manager = createManager(logs, req.body);
        const result = await manager.withPortLock(portInfoFromBody(req.body), async portInfo => {
            const profile = getProfileById(req.body.profileId);
            if (!profile) throw new Error("Unsupported Sylvie profile");
            const hexPath = localHexPathFromRequest(req.body);
            if (!hexPath || !fs.existsSync(hexPath)) throw new Error("Compiled Sylvie hex file was not found");
            await manager.uploadFirmware(hexPath, portInfo, profile);
            return {
                success: true,
                device: deviceResponse(profile, "manual", profile.hardware.signature)
            };
        });
        res.json(Object.assign(result, {logs}));
    } catch (error) {
        res.status(500).json(Object.assign(classifySylvieError(error), {logs}));
    }
});

router.post("/compile-upload", async (req, res) => {
    const logs = [];
    try {
        const result = await createManager(logs, req.body).compileAndUpload({
            sourceCode: req.body.sourceCode || req.body.code,
            portInfo: portInfoFromBody(req.body),
            profileId: req.body.profileId,
            forceDetect: Boolean(req.body.forceDetect || req.body.redetect)
        });
        res.status(result.success ? 200 : 500).json(Object.assign(result, {logs}));
    } catch (error) {
        res.status(500).json(Object.assign(classifySylvieError(error), {logs}));
    }
});

module.exports = router;