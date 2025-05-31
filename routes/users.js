import express from "express";
import pgclient from "../db.js";

const router = express.Router();

//get current user profile
router.get("/me", async (req, res) => {
    try {
        const user = req.user;

        // Fetch user preferences/allergies
        const preferencesResult = await pgclient.query(
            'SELECT preference FROM user_preference WHERE user_id = $1',
            [user.id]
        );
        
        const allergies = preferencesResult.rows.map(row => row.preference);

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin,
            allergies: allergies
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Failed to fetch user profile" });
    }
});

//update current user profile
router.put("/me", async (req, res) => {
    const client = await pgclient.connect();
    
    try {
        const { username, email, allergies = [] } = req.body;
        const userId = req.user.id;

        await client.query("BEGIN");

        // Update basic user info
        const updatedUser = await client.query(
            'UPDATE "user" SET username = $1, email = $2 WHERE id = $3 RETURNING id, username, email, is_admin',
            [username, email, userId]
        );

        if (updatedUser.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "User not found" });
        }

        // Clear existing allergies/preferences
        await client.query(
            'DELETE FROM user_preference WHERE user_id = $1',
            [userId]
        );

        // Insert new allergies/preferences
        for (const allergy of allergies) {
            if (allergy && allergy.trim()) {
                await client.query(
                    'INSERT INTO user_preference (user_id, preference) VALUES ($1, $2)',
                    [userId, allergy.trim()]
                );
            }
        }

        await client.query("COMMIT");

        const user = updatedUser.rows[0];
        
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin,
            allergies: allergies
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating user profile:", error);
        res.status(500).json({ error: "Failed to update user profile" });
    } finally {
        client.release();
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

router.get("/my-recipes", async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Fetch user's community recipes
        const recipes = await pgclient.query(
            `SELECT cr.*, u.username as created_by_username 
             FROM community_recipes cr 
             LEFT JOIN "user" u ON cr.created_by = u.id 
             WHERE cr.created_by = $1 
             ORDER BY cr.created_at DESC`,
            [userId]
        );
        
        res.json(recipes.rows);
    } catch (error) {
        console.error("Error fetching user recipes:", error);
        res.status(500).json({ error: "Failed to fetch user recipes" });
    }
});

export default router;