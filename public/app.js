
const API_BASE_URL = "https://leave-management-system-1-ljsr.onrender.com";

let authToken = localStorage.getItem("token");
let currentUser = null;

// GET HTML ELEMENT
const $ = (id) => document.getElementById(id);

// API REQUEST FUNCTION
async function apiRequest(endpoint, method = "GET", data = null) {
    try {
        const headers = {
            "Content-Type": "application/json"
        };

        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const options = {
            method,
            headers
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(
            API_BASE_URL + endpoint,
            options
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.error || "Request failed");
        }

        return result;

    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

// SHOW MESSAGE
function showMessage(id, message, success = false) {
    const element = $(id);

    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "green" : "red";
}

// HIDE ALL SECTIONS
function hideAllSections() {
    [
        "loginSection",
        "registerSection",
        "studentDashboard",
        "authorityDashboard"
    ].forEach(id => {
        $(id).classList.add("hidden");
    });
}

// LOGIN / REGISTER NAVIGATION
$("showRegisterBtn").addEventListener("click", () => {
    hideAllSections();
    $("registerSection").classList.remove("hidden");
});

$("showLoginBtn").addEventListener("click", () => {
    hideAllSections();
    $("loginSection").classList.remove("hidden");
});

// STUDENT REGISTRATION
$("registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const userData = {
        username: $("registerName").value.trim(),
        rollNumber: $("registerRoll").value.trim(),
        email: $("registerEmail").value.trim().toLowerCase(),
        password: $("registerPassword").value
    };

    try {
        showMessage("registerMessage", "Registering...");

        const result = await apiRequest(
            "/api/register",
            "POST",
            userData
        );

        showMessage(
            "registerMessage",
            result.message || "Registration successful! Please login.",
            true
        );

        $("registerForm").reset();

    } catch (error) {
        showMessage("registerMessage", error.message);
    }
});

// LOGIN
$("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("loginEmail").value.trim().toLowerCase();
    const password = $("loginPassword").value;

    try {
        showMessage("loginMessage", "Logging in...");

        const result = await apiRequest(
            "/api/login",
            "POST",
            { email, password }
        );

        const token =
            result.token ||
            result.accessToken;

        if (!token) {
            throw new Error("Login response does not contain a token");
        }

        authToken = token;
        localStorage.setItem("token", authToken);

        currentUser =
            result.user ||
            result;

        await loadUserDashboard();

    } catch (error) {
        authToken = null;
        currentUser = null;
        localStorage.removeItem("token");

        showMessage("loginMessage", error.message);
    }
});

// LOAD USER DASHBOARD
async function loadUserDashboard() {
    try {
        const result = await apiRequest("/api/me");

        currentUser = result.user || result;

        hideAllSections();

        $("logoutBtn").classList.remove("hidden");

        if (currentUser.role === "authority") {
            $("authorityDashboard").classList.remove("hidden");
            await loadAuthorityLeaves();
        } else {
            $("studentDashboard").classList.remove("hidden");
            $("studentWelcome").textContent =
                "Welcome, " + (currentUser.username || "Student");

            await loadStudentData();
        }

    } catch (error) {
        console.error("Dashboard loading error:", error);

        authToken = null;
        currentUser = null;
        localStorage.removeItem("token");

        $("logoutBtn").classList.add("hidden");
        hideAllSections();
        $("loginSection").classList.remove("hidden");

        showMessage("loginMessage", error.message);
    }
}

// STUDENT DASHBOARD DATA
async function loadStudentData() {
    await loadLeaveBalance();
    await loadMyLeaves();
}

// LEAVE BALANCE
async function loadLeaveBalance() {
    try {
        const result = await apiRequest("/api/leave-balance");

        const balance = result.balance || result;

        $("casualBalance").textContent =
            balance.casualLeave ?? balance.casual ?? 0;

        $("medicalBalance").textContent =
            balance.medicalLeave ?? balance.medical ?? 0;

    } catch (error) {
        console.error("Leave balance error:", error);
    }
}

// APPLY LEAVE
$("leaveForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const fromDate = $("fromDate").value;
    const toDate = $("toDate").value;

    if (new Date(toDate) < new Date(fromDate)) {
        showMessage("leaveMessage", "To Date cannot be before From Date");
        return;
    }

    const leaveData = {
        leaveType: $("leaveType").value,
        fromDate,
        toDate,
        reason: $("reason").value.trim()
    };

    try {
        showMessage("leaveMessage", "Submitting leave request...");

        const result = await apiRequest(
            "/api/apply-leave",
            "POST",
            leaveData
        );

        showMessage(
            "leaveMessage",
            result.message || "Leave request submitted successfully",
            true
        );

        $("leaveForm").reset();

        await loadStudentData();

    } catch (error) {
        showMessage("leaveMessage", error.message);
    }
});

// STUDENT LEAVE HISTORY
async function loadMyLeaves() {
    try {
        const result = await apiRequest("/api/my-leaves");

        const leaves = Array.isArray(result)
            ? result
            : result.leaves || [];

        const table = $("studentLeaveTable");
        table.innerHTML = "";

        if (leaves.length === 0) {
            table.innerHTML =
                '<tr><td colspan="7">No leave requests found</td></tr>';
            return;
        }

        leaves.forEach(leave => {
            const row = document.createElement("tr");

            const values = [
                leave.leaveType || leave.type || "-",
                formatDate(leave.fromDate),
                formatDate(leave.toDate),
                leave.days ?? calculateDays(leave.fromDate, leave.toDate),
                leave.reason || "-",
                leave.status || "Pending",
                leave.remarks || "-"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            table.appendChild(row);
        });

    } catch (error) {
        console.error("My leaves error:", error);
    }
}

// AUTHORITY DASHBOARD
async function loadAuthorityLeaves() {
    try {
        const result = await apiRequest("/api/authority/leaves");

        const leaves = Array.isArray(result)
            ? result
            : result.leaves || [];

        $("totalRequests").textContent = leaves.length;

        $("pendingRequests").textContent =
            leaves.filter(l => l.status === "Pending").length;

        $("approvedRequests").textContent =
            leaves.filter(l => l.status === "Approved").length;

        $("rejectedRequests").textContent =
            leaves.filter(l => l.status === "Rejected").length;

        const table = $("authorityLeaveTable");
        table.innerHTML = "";

        if (leaves.length === 0) {
            table.innerHTML =
                '<tr><td colspan="9">No leave requests found</td></tr>';
            return;
        }

        leaves.forEach(leave => {
            const row = document.createElement("tr");

            const values = [
                leave.student?.username || leave.username || "-",
                leave.student?.rollNumber || leave.rollNumber || "-",
                leave.leaveType || leave.type || "-",
                formatDate(leave.fromDate),
                formatDate(leave.toDate),
                leave.days ?? calculateDays(leave.fromDate, leave.toDate),
                leave.reason || "-",
                leave.status || "Pending"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");

            if ((leave.status || "").toLowerCase() === "pending") {
                const approveBtn = document.createElement("button");
                approveBtn.textContent = "Approve";
                approveBtn.addEventListener("click", () => {
                    updateLeaveStatus(leave._id, "Approved");
                });

                const rejectBtn = document.createElement("button");
                rejectBtn.textContent = "Reject";
                rejectBtn.addEventListener("click", () => {
                    updateLeaveStatus(leave._id, "Rejected");
                });

                actionCell.append(approveBtn, rejectBtn);
            } else {
                actionCell.textContent = "Completed";
            }

            row.appendChild(actionCell);
            table.appendChild(row);
        });

    } catch (error) {
        console.error("Authority leaves error:", error);
        alert(error.message);
    }
}

// APPROVE / REJECT LEAVE
async function updateLeaveStatus(leaveId, status) {
    const remarks = prompt("Enter remarks (optional):");

    if (remarks === null) return;

    try {
        const result = await apiRequest(
            `/api/authority/leaves/${leaveId}`,
            "PATCH",
            { status, remarks }
        );

        alert(result.message || `Leave ${status.toLowerCase()} successfully`);

        await loadAuthorityLeaves();

    } catch (error) {
        alert(error.message);
    }
}

// REFRESH AUTHORITY DASHBOARD
$("refreshBtn").addEventListener("click", () => {
    loadAuthorityLeaves();
});

// LOGOUT
$("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");

    authToken = null;
    currentUser = null;

    $("logoutBtn").classList.add("hidden");

    $("loginForm").reset();

    hideAllSections();
    $("loginSection").classList.remove("hidden");
});

// DATE FORMAT
function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN");
}

// CALCULATE LEAVE DAYS
function calculateDays(from, to) {
    if (!from || !to) return 0;

    const start = new Date(from);
    const end = new Date(to);

    return Math.round((end - start) / 86400000) + 1;
}

// AUTOMATIC LOGIN SESSION CHECK
document.addEventListener("DOMContentLoaded", async () => {
    if (authToken) {
        await loadUserDashboard();
    } else {
        hideAllSections();
        $("loginSection").classList.remove("hidden");
    }
});
