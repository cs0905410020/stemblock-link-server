const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const compileRoute = require("./routes/compile");
const downloadRoute = require("./routes/download");
const firmwareRoute = require("./routes/firmwares");

const app = express();
const PORT = process.env.PORT || 20111;

// Security & middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("combined"));

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "stemblock-link-server",
        time: new Date().toISOString()
    });
});

const rateLimit = require("express-rate-limit");

const compileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 compiles per minute per IP
    standardHeaders: true,
    legacyHeaders: false
});

app.use("/compile", compileLimiter);

// Compile API
app.use("/compile", compileRoute);
app.use("/download", downloadRoute);
app.use("/firmwares", firmwareRoute);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 stemblock-link-server running on port ${PORT}`);
});
