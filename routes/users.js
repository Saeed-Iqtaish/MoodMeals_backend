import express from "express";
import pgclient from "../db.js";

const router = express.Router();

//get current user profile
router.get("/me", async (req, res) => {
    try {
        const user = req.user;

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Failed to fetch user profile" });
    }
});

//update current user profile
router.put("/me", async (req, res) => {
    try {
        const { username, email } = req.body;
        const userId = req.user.id;

        const updatedUser = await pgclient.query(
            'UPDATE "user" SET username = $1, email = $2 WHERE id = $3 RETURNING id, username, email, is_admin',
            [username, email, userId]
        );

        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = updatedUser.rows[0];
        
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ error: "Failed to update user profile" });
    }
});

//admin route - get all users
router.get("/", async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ error: "Admin access required" });
        }

        const users = await pgclient.query('SELECT id, username, email, is_admin FROM "user" ORDER BY id');
        res.json(users.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

export default router;