const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* ---------------------------------------------------------
   FIX CORS CODESPACES — ALWAYS SEND HEADERS (even on 401)
--------------------------------------------------------- */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Codespaces requires OPTIONS to return immediately
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

/* ---------------------------------------------------------
   Normal CORS middleware (kept for compatibility)
--------------------------------------------------------- */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

/* ---------------------------------------------------------
   JSON parser
--------------------------------------------------------- */
app.use(express.json());

const ACCOUNTS_FILE = "./accounts.json";

/* ---------------------------------------------------------
   Load accounts
--------------------------------------------------------- */
function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return {};
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
}

/* ---------------------------------------------------------
   Save accounts
--------------------------------------------------------- */
function saveAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

/* ---------------------------------------------------------
   Ensure Admin exists
--------------------------------------------------------- */
async function ensureAdminExists() {
  const accounts = loadAccounts();

  if (!accounts["Admin"]) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    accounts["Admin"] = { password: hashed };
    saveAccounts(accounts);
    console.log("Admin account created.");
  }
}

ensureAdminExists();

/* ---------------------------------------------------------
   JWT generator
--------------------------------------------------------- */
function createToken(username) {
  return jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

/* ---------------------------------------------------------
   REGISTER
--------------------------------------------------------- */
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  const accounts = loadAccounts();

  if (accounts[username]) {
    return res.status(400).json({ error: "Username already exists" });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password too short" });
  }

  const hashed = await bcrypt.hash(password, 10);
  accounts[username] = { password: hashed };
  saveAccounts(accounts);

  return res.json({ success: true });
});

/* ---------------------------------------------------------
   LOGIN
--------------------------------------------------------- */
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const accounts = loadAccounts();

  if (!accounts[username]) {
    return res.status(400).json({ error: "User not found" });
  }

  const valid = await bcrypt.compare(password, accounts[username].password);

  if (!valid) {
    return res.status(400).json({ error: "Incorrect password" });
  }

  const token = createToken(username);

  return res.json({ token, username });
});

/* ---------------------------------------------------------
   Start server
--------------------------------------------------------- */
app.listen(3000, () => console.log("Backend running on port 3000"));
