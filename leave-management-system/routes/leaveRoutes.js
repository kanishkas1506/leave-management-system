const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Leave = require("../models/Leave");

const router = express.Router();


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

function authenticate(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}


// ======================================================
// AUTHORITY MIDDLEWARE
// ======================================================

function authorityOnly(req, res, next) {

    if (req.user.role !== "authority") {
        return res.status(403).json({
            message: "Authority access only"
        });
    }

    next();
}


// ======================================================
// STUDENT REGISTER
// ======================================================

router.post("/register", async (req, res) => {

    try {

        const {
            username,
            email,
            password,
            rollNumber
        } = req.body;

        if (
            !username ||
            !email ||
            !password ||
            !rollNumber
        ) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters"
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        const existingUser =
            await User.findOne({
                $or: [
                    { email: normalizedEmail },
                    { rollNumber: rollNumber.trim() }
                ]
            });

        if (existingUser) {

            return res.status(400).json({
                message: "Email or Roll Number already exists"
            });
        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const user = await User.create({

            username: username.trim(),

            email: normalizedEmail,

            rollNumber: rollNumber.trim(),

            password: hashedPassword,

            role: "student",

            casualLeave: 10,

            medicalLeave: 10
        });

        res.status(201).json({

            message: "Registration successful",

            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                rollNumber: user.rollNumber,
                role: user.role
            }

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});


// ======================================================
// LOGIN - STUDENT / AUTHORITY
// ======================================================

router.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        const user =
            await User.findOne({
                email: normalizedEmail
            });

        if (!user) {

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatch) {

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token =
            jwt.sign(
                {
                    id: user._id,
                    role: user.role
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "8h"
                }
            );

        res.json({

            message: "Login successful",

            token,

            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                rollNumber: user.rollNumber,
                role: user.role,
                casualLeave: user.casualLeave,
                medicalLeave: user.medicalLeave
            }

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});


// ======================================================
// GET CURRENT USER
// ======================================================

router.get("/me", authenticate, async (req, res) => {

    try {

        const user =
            await User.findById(req.user.id)
            .select("-password");

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            user
        });

    } catch (error) {

        res.status(500).json({
            message: "Unable to get user"
        });
    }
});


// ======================================================
// GET LEAVE BALANCE
// ======================================================

router.get(
    "/leave-balance",
    authenticate,
    async (req, res) => {

        try {

            const user =
                await User.findById(req.user.id);

            res.json({

                casualLeave: user.casualLeave,

                medicalLeave: user.medicalLeave

            });

        } catch (error) {

            res.status(500).json({
                message: "Unable to get leave balance"
            });
        }
    }
);


// ======================================================
// STUDENT APPLY LEAVE
// ======================================================

router.post(
    "/apply-leave",
    authenticate,
    async (req, res) => {

        try {

            if (req.user.role !== "student") {

                return res.status(403).json({
                    message: "Only students can apply for leave"
                });
            }

            const {
                leaveType,
                fromDate,
                toDate,
                reason
            } = req.body;

            if (
                !leaveType ||
                !fromDate ||
                !toDate ||
                !reason
            ) {

                return res.status(400).json({
                    message: "All leave fields are required"
                });
            }

            if (
                !["casual", "medical"].includes(
                    leaveType
                )
            ) {

                return res.status(400).json({
                    message: "Invalid leave type"
                });
            }

            const start =
                new Date(fromDate);

            const end =
                new Date(toDate);

            if (
                Number.isNaN(start.getTime()) ||
                Number.isNaN(end.getTime())
            ) {

                return res.status(400).json({
                    message: "Invalid date"
                });
            }

            if (end < start) {

                return res.status(400).json({
                    message: "To date must be after From date"
                });
            }

            const oneDay =
                1000 * 60 * 60 * 24;

            const days =
                Math.floor(
                    (end - start) / oneDay
                ) + 1;

            const student =
                await User.findById(req.user.id);

            const availableBalance =
                leaveType === "casual"
                    ? student.casualLeave
                    : student.medicalLeave;

            if (days > availableBalance) {

                return res.status(400).json({
                    message:
                        `Only ${availableBalance} days available`
                });
            }

            const leave =
                await Leave.create({

                    student: student._id,

                    leaveType,

                    fromDate: start,

                    toDate: end,

                    days,

                    reason: reason.trim(),

                    status: "Pending"

                });

            res.status(201).json({

                message: "Leave request submitted",

                leave

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Unable to apply leave"
            });
        }
    }
);


// ======================================================
// STUDENT VIEW OWN LEAVES
// ======================================================

router.get(
    "/my-leaves",
    authenticate,
    async (req, res) => {

        try {

            const leaves =
                await Leave.find({
                    student: req.user.id
                })
                .sort({
                    createdAt: -1
                });

            res.json({
                leaves
            });

        } catch (error) {

            res.status(500).json({
                message: "Unable to get leave requests"
            });
        }
    }
);


// ======================================================
// AUTHORITY VIEW ALL LEAVES
// ======================================================

router.get(
    "/authority/leaves",
    authenticate,
    authorityOnly,
    async (req, res) => {

        try {

            const leaves =
                await Leave.find()
                .populate(
                    "student",
                    "username email rollNumber"
                )
                .populate(
                    "reviewedBy",
                    "username email"
                )
                .sort({
                    createdAt: -1
                });

            res.json({
                leaves
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Unable to get leave requests"
            });
        }
    }
);


// ======================================================
// AUTHORITY APPROVE / REJECT
// ======================================================

router.patch(
    "/authority/leaves/:id",
    authenticate,
    authorityOnly,
    async (req, res) => {

        try {

            const {
                status,
                authorityRemarks
            } = req.body;

            if (
                !["Approved", "Rejected"].includes(
                    status
                )
            ) {

                return res.status(400).json({
                    message: "Invalid status"
                });
            }

            if (
                status === "Rejected" &&
                !authorityRemarks?.trim()
            ) {

                return res.status(400).json({
                    message:
                        "Rejection reason is required"
                });
            }

            const leave =
                await Leave.findById(
                    req.params.id
                );

            if (!leave) {

                return res.status(404).json({
                    message: "Leave request not found"
                });
            }

            if (leave.status !== "Pending") {

                return res.status(400).json({
                    message:
                        "This leave has already been reviewed"
                });
            }


            // ==========================================
            // APPROVE
            // ==========================================

            if (status === "Approved") {

                const student =
                    await User.findById(
                        leave.student
                    );

                if (!student) {

                    return res.status(404).json({
                        message: "Student not found"
                    });
                }

                if (
                    leave.leaveType === "casual"
                ) {

                    if (
                        student.casualLeave <
                        leave.days
                    ) {

                        return res.status(400).json({
                            message:
                                "Insufficient casual leave balance"
                        });
                    }

                    student.casualLeave -=
                        leave.days;

                } else {

                    if (
                        student.medicalLeave <
                        leave.days
                    ) {

                        return res.status(400).json({
                            message:
                                "Insufficient medical leave balance"
                        });
                    }

                    student.medicalLeave -=
                        leave.days;
                }

                await student.save();
            }


            // ==========================================
            // UPDATE LEAVE
            // ==========================================

            leave.status = status;

            leave.authorityRemarks =
                authorityRemarks?.trim() || "";

            leave.reviewedBy =
                req.user.id;

            leave.reviewedAt =
                new Date();

            await leave.save();


            res.json({

                message:
                    `Leave ${status.toLowerCase()} successfully`,

                leave

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to update leave status"
            });
        }
    }
);


module.exports = router;