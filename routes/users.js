import express from "express";
import pgclient from "../db.js";

const router = express.Router();

router.post("/profile", async (req, res) => {
    try {
        const auth0Id = req.user.sub;
        
        // Get additional user info from different possible sources
        const email = req.user.email || req.user['https://api.moodmeals.com/email'] || null;
        const name = req.user.name || req.user['https://api.moodmeals.com/name'] || req.user.nickname || null;
        
        // Generate username from different sources
        let username;
        if (name) {
            username = name;
        } else if (email) {
            username = email.split('@')[0];
        } else {
            // Use the Auth0 ID as fallback
            username = `user_${auth0Id.split('|')[1] || auth0Id}`;
        }
        
        console.log('Creating/getting profile for Auth0 user:', { 
            auth0Id, 
            email: email || 'not provided', 
            username,
            rawUser: req.user 
        });
        
        const existingUser = await pgclient.query(
            'SELECT * FROM "user" WHERE auth0_id = $1',
            [auth0Id]
        );

        if (existingUser.rows.length > 0) {
            const updatedUser = await pgclient.query(
                'UPDATE "user" SET username = $1, email = $2 WHERE auth0_id = $3 RETURNING *',
                [username, email, auth0Id]
            );
            
            res.json({
                message: "User profile retrieved",
                user: updatedUser.rows[0]
            });
        } else {
            const newUser = await pgclient.query(
                `INSERT INTO "user" (username, email, auth0_id, is_admin) 
                 VALUES ($1, $2, $3, false) 
                 RETURNING *`,
                [username, email, auth0Id]
            );
            res.status(201).json({
                message: "User created successfully",
                user: newUser.rows[0]
            });
        }
    } catch (error) {
        console.error("Error managing user profile:", error);
        res.status(500).json({ error: "Failed to manage user profile" });
    }
});

//get current user profile
router.get("/me", async (req, res) => {
    try {
        const auth0Id = req.user.sub;
        
        const user = await pgclient.query(
            'SELECT * FROM "user" WHERE auth0_id = $1',
            [auth0Id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: "User profile not found" });
        }

        res.json(user.rows[0]);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Failed to fetch user profile" });
    }
});

//update current user profile
router.put("/me", async (req, res) => {
    try {
        const auth0Id = req.user.sub;
        const { username } = req.body;

        const result = await pgclient.query(
            `UPDATE "user" SET username = $1 WHERE auth0_id = $2 RETURNING *`,
            [username, auth0Id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            message: "Profile updated successfully",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ error: "Failed to update user profile" });
    }
});

//admin route - get all users
router.get("/", async (req, res) => {
    try {
        const users = await pgclient.query('SELECT id, username, email, auth0_id, is_admin FROM "user" ORDER BY id');
        res.json(users.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

export default router;