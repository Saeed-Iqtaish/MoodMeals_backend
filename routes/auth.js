import express from "express";
import pgclient from "../db.js";
import { hashPassword, comparePassword, generateToken } from "../middleware/auth.js";

const router = express.Router();

// Register new user
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: "All fields are required",
        details: "Username, email, and password must be provided"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        error: "Password too short",
        details: "Password must be at least 8 characters long"
      });
    }

    // Check if user already exists
    const existingUser = await pgclient.query(
      'SELECT id FROM "user" WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: "User already exists",
        details: "A user with this email or username already exists"
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await pgclient.query(
      `INSERT INTO "user" (username, email, password, is_admin) 
       VALUES ($1, $2, $3, false) 
       RETURNING id, username, email, is_admin`,
      [username, email, hashedPassword]
    );

    const user = newUser.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin
      }
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ 
      error: "Failed to create user",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: "All fields are required",
        details: "Email and password must be provided"
      });
    }

    // Find user
    const userResult = await pgclient.query(
      'SELECT id, username, email, password, is_admin FROM "user" WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: "Invalid credentials",
        details: "Email or password is incorrect"
      });
    }

    const user = userResult.rows[0];

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: "Invalid credentials",
        details: "Email or password is incorrect"
      });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin
      }
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ 
      error: "Login failed",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user (protected route)
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.substring(7);
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const userResult = await pgclient.query(
      'SELECT id, username, email, is_admin FROM "user" WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;