const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const {
    getNethubRuntimeLibsForCode,
    getRuntimeLibPath,
    validateRuntimeLib
} = require("../lib/runtimeLibs");
const { getNethubUploadMetadata } = require("../lib/nethubSupport");

const MPY_CROSS = process.env.MPY_CROSS
    ? path.resolve(process.env.MPY_CROSS)
    : path.resolve(__dirname, "../toolchains/micropython/mpy-cross/build/mpy-cross");
const IR_RX_RUNTIME_PACKAGE = "ir_rx";
const IR_RX_DEVICE_PACKAGE = "lib/ir_rx";
const IR_RX_REQUIRED_FILES = Object.freeze([
    "__init__.py",
    "nec.py",
    "print_error.py"
]);

function codeRequiresIrRx(code = "") {
    return /\bfrom\s+ir_rx(?:\.nec)?\s+import\b|\bimport\s+ir_rx(?:\.nec)?\b|\bNEC_8\b/.test(code);
}

function normalizeIrRxImportStyle(code = "") {
    let normalized = String(code || "");

    if (/\bir_rx\.nec\.NEC_8\b/.test(normalized)) {
        normalized = normalized.replace(/^\s*import\s+ir_rx\.nec\s*$/gm, "");
        normalized = normalized.replace(/\bir_rx\.nec\.NEC_8\b/g, "NEC_8");

        if (!/^\s*from\s+ir_rx\.nec\s+import\s+NEC_8\s*$/m.test(normalized)) {
            normalized = `from ir_rx.nec import NEC_8\n${normalized}`;
        }
    }

    return normalized;
}

function getIrRxPackageFiles() {
    const packageDir = getRuntimeLibPath(IR_RX_RUNTIME_PACKAGE);
    const missingFiles = IR_RX_REQUIRED_FILES
        .filter(filename => !fs.existsSync(path.join(packageDir, filename)));

    if (missingFiles.length) {
        throw new Error(`Missing Nethub IR receiver runtime file(s): ${missingFiles.join(", ")}`);
    }

    const necSource = fs.readFileSync(path.join(packageDir, "nec.py"), "utf8");
    if (!/\bclass\s+NEC_8\b/.test(necSource)) {
        throw new Error("Nethub IR receiver runtime file ir_rx/nec.py must define NEC_8");
    }

    if (/\bfrom\s+ir_tx\b|\bimport\s+ir_tx\b/.test(necSource)) {
        throw new Error("Nethub IR receiver runtime file ir_rx/nec.py must not depend on ir_tx");
    }

    return fs.readdirSync(packageDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === ".py")
        .map(entry => `${IR_RX_RUNTIME_PACKAGE}/${entry.name}`)
        .sort();
}

function createIrRxBootstrap() {
    const packageFiles = getIrRxPackageFiles();

    const writeLines = packageFiles.flatMap(relativeFile => {
        const filePath = getRuntimeLibPath(relativeFile);
        const contents = fs.readFileSync(filePath, "utf8");
        const deviceFile = `${IR_RX_DEVICE_PACKAGE}/${path.basename(relativeFile)}`;

        return [
            `_stemblock_write_file(${JSON.stringify(deviceFile)}, ${JSON.stringify(contents)})`
        ];
    });

    return [
        "# Stemblock Nethub runtime dependency bootstrap",
        "import os as _stemblock_os",
        "import sys as _stemblock_sys",
        "",
        "if '/lib' not in _stemblock_sys.path:",
        "    _stemblock_sys.path.append('/lib')",
        "",
        "def _stemblock_mkdir(path):",
        "    try:",
        "        _stemblock_os.mkdir(path)",
        "    except OSError:",
        "        pass",
        "",
        "def _stemblock_write_file(path, data):",
        "    parts = path.split('/')[:-1]",
        "    current = ''",
        "    for part in parts:",
        "        current = part if not current else current + '/' + part",
        "        _stemblock_mkdir(current)",
        "    with open(path, 'w') as f:",
        "        f.write(data)",
        "",
        ...writeLines,
        "",
        "del _stemblock_write_file",
        "del _stemblock_mkdir",
        "del _stemblock_os",
        "del _stemblock_sys",
        "# End Stemblock Nethub runtime dependency bootstrap",
        ""
    ].join("\n");
}

function getRuntimeLibDestination(srcDir, lib) {
    if (lib === IR_RX_RUNTIME_PACKAGE) {
        return path.join(srcDir, "lib", IR_RX_RUNTIME_PACKAGE);
    }

    return path.join(srcDir, lib);
}

function injectRuntimeLibraries(srcDir, code, callback) {

    const libs = getNethubRuntimeLibsForCode(code);

    try {
        const pyFiles = [];

        // Copy first
        libs.forEach(lib => {
            const src = validateRuntimeLib(lib);
            const dest = getRuntimeLibDestination(srcDir, lib);

            if (fs.statSync(src).isDirectory()) {
                fs.cpSync(src, dest, { recursive: true });

                function collectPackageFiles(dir) {
                    fs.readdirSync(dir, { withFileTypes: true })
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .forEach(entry => {
                            const fullPath = path.join(dir, entry.name);

                            if (entry.isDirectory()) {
                                collectPackageFiles(fullPath);
                                return;
                            }

                            if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".py") {
                                pyFiles.push(fullPath);
                            }
                        });
                }

                collectPackageFiles(dest);
                return;
            }

            fs.copyFileSync(src, dest);
            pyFiles.push(dest);
        });

        // Compile sequentially (VERY IMPORTANT)
        function compileNext(index) {

            if (index >= pyFiles.length) {
                return callback(null, pyFiles);
            }

            const py = pyFiles[index];
            const mpy = py.replace(".py", ".mpy");

            const cmd = `"${MPY_CROSS}" "${py}" -o "${mpy}"`;

            exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {

                if (err || !fs.existsSync(mpy)) {
                    const lib = path.relative(srcDir, py);
                    return callback(`Failed compiling ${lib}: ${stderr || err.message}`);
                }

                compileNext(index + 1);
            });
        }

        compileNext(0);

    } catch (e) {
        callback(e.message);
    }
}
function compileNetHub({ code, jobDir }) {

    return new Promise((resolve, reject) => {
        if (!fs.existsSync(MPY_CROSS)) {
            return reject(`mpy-cross not found at ${MPY_CROSS}`);
        }

        const srcDir = path.join(jobDir, "fs");
        fs.mkdirSync(srcDir, { recursive: true });

        // main.py (user program)
        const pyFile = path.join(srcDir, "main.py");
        const normalizedCode = normalizeIrRxImportStyle(code);
        const finalCode = codeRequiresIrRx(normalizedCode) ? `${createIrRxBootstrap()}\n${normalizedCode}` : normalizedCode;
        fs.writeFileSync(pyFile, finalCode);

        // 2. inject + compile libraries FIRST
        injectRuntimeLibraries(srcDir, code, (libErr, runtimeLibraryFiles = []) => {

            if (libErr) {
                return reject(libErr);
            }

            // 3. compile main LAST
            const mpyFile = path.join(srcDir, "main.mpy");

            const cmd = `"${MPY_CROSS}" "${pyFile}" -o "${mpyFile}"`;

        exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {

            if (err) {
                return reject(stderr || err.message);
            }

            if (!fs.existsSync(mpyFile)) {
                return reject("MPY generation failed");
            }

                // DO NOT TOUCH (your original resolve format)
                resolve({
                    message: "NetHub MicroPython compiled",
                    files: {
                        py: pyFile,
                        mpy: mpyFile,
                        runtime: runtimeLibraryFiles.flatMap(file => [
                            file,
                            file.replace(".py", ".mpy")
                        ])
                    },
                    upload: getNethubUploadMetadata(),
                    stdout
                });
            });

        });
    });
}

module.exports = { compileNetHub };
