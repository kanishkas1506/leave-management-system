
require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");

const connectDB = require("./config/db");
const User = require("./models/User");
const leaveRoutes = require("./routes/leaveRoutes");

const app = express();
const PORT = process.env.PORT || 5050;


// ======================================================
// JWT SECRET CHECK
// ======================================================

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing");
    process.exit(1);
}


// ======================================================
// CORS CONFIGURATION
// ======================================================

app.use((req, res, next) => {

    const allowedOrigin =
        "https://kanishkas1506.github.io";

    const origin = req.headers.origin;

    if (origin === allowedOrigin) {

        res.header(
            "Access-Control-Allow-Origin",
            allowedOrigin
        );

        res.header(
            "Vary",
            "Origin"
        );
    }

    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );

    res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ======================================================
// API ROUTES
// ======================================================

app.use("/api", leaveRoutes);


// ======================================================
// CREATE / UPDATE AUTHORITY ACCOUNT
// ======================================================

async function createAuthority() {

    const email =
        process.env.AUTHORITY_EMAIL?.trim().toLowerCase();

    const password =
        process.env.AUTHORITY_PASSWORD;

    const username =
        process.env.AUTHORITY_NAME ||
        "Leave Administrator";

    if (!email || !password) {

        throw new Error(
            "AUTHORITY_EMAIL and AUTHORITY_PASSWORD are required"
        );
    }

    let authority = await User.findOne({ email });

    const hashedPassword =
        await bcrypt.hash(password, 12);

    if (!authority) {

        authority = await User.create({

            username,

            email,

            password: hashedPassword,

            role: "authority",

            rollNumber: "",

            casualLeave: 0,

            medicalLeave: 0

        });

        console.log(
            "Authority account created successfully"
        );

    } else {

        authority.username = username;

        authority.password = hashedPassword;

        authority.role = "authority";

        await authority.save();

        console.log(
            "Authority account updated successfully"
        );
    }
}


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    try {

        await connectDB();

        await createAuthority();

        app.listen(PORT, "0.0.0.0", () => {

            console.log(
                `Server running on port ${PORT}`
            );

        });

    } catch (error) {

        console.error(
            "Application startup failed:",
            error.message
        );

        process.exit(1);
    }
}


// ======================================================
// START APPLICATION
// ======================================================

startServer();

require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");

const connectDB = require("./config/db");
const User = require("./models/User");
const leaveRoutes = require("./routes/leaveRoutes");

const app = express();
const PORT = process.env.PORT || 5050;

// JWT SECRET CHECK
if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in Render Environment");
    process.exit(1);
}

// CORS CONFIGURATION
app.use((req, res, next) => {
    const allowedOrigin = "https://kanishkas1506.github.io";
    const origin = req.headers.origin;

    if (origin === allowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
        res.setHeader("Vary", "Origin");
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// FRONTEND STATIC FILES
app.use(express.static(path.join(__dirname, "public")));

// SERVER HEALTH CHECK
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Leave Management Server is running"
    });
});

// API ROUTES
app.use("/api", leaveRoutes);

// CREATE / UPDATE AUTHORITY ACCOUNT
async function createAuthority() {
    const email = process.env.AUTHORITY_EMAIL
        ? process.env.AUTHORITY_EMAIL.trim().toLowerCase()
        : "";

    const password = process.env.AUTHORITY_PASSWORD;

    const username =
        process.env.AUTHORITY_NAME || "Leave Administrator";

    if (!email || !password) {
        throw new Error(
            "AUTHORITY_EMAIL or AUTHORITY_PASSWORD is missing in Render Environment"
        );
    }

    let authority = await User.findOne({ email });

    const hashedPassword = await bcrypt.hash(password, 12);

    if (!authority) {
        await User.create({
            username,
            email,
            password: hashedPassword,
            role: "authority",
            rollNumber: "",
            casualLeave: 0,
            medicalLeave: 0
        });

        console.log("Authority account created successfully");
    } else {
        authority.username = username;
        authority.password = hashedPassword;
        authority.role = "authority";

        await authority.save();

        console.log("Authority account updated successfully");
    }
}

// START SERVER
async function startServer() {
    try {
        await connectDB();

        await createAuthority();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("================================");
            console.log("Leave Management Server Started");
            console.log("Port:", PORT);
            console.log("================================");
        });

    } catch (error) {
        console.error("Application startup failed:", error);
        process.exit(1);
    }
}

startServer();
