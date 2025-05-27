import express from "express";
import pgclient from "../db.js";

const router = express.Router();

async function getUserIdFromAuth0(auth0Id) {
    const userResult = await pgclient.query(
        'SELECT id FROM "user" WHERE auth0_id = $1',
        [auth0Id]
    );
    
    if (userResult.rows.length === 0) {
        throw new Error("User not found");
    }
    
    return userResult.rows[0].id;
}

//get notes for a specific recipe
router.get("/recipe/:recipeId", async (req, res) => {
    try {
        const { recipeId } = req.params;
        const userId = await getUserIdFromAuth0(req.user.sub);
        
        const notes = await pgclient.query(
            "SELECT * FROM notes WHERE recipe_id = $1 AND user_id = $2",
            [recipeId, userId]
        );

        res.json(notes.rows);
    } catch (error) {
        console.error("Error fetching notes:", error);
        res.status(500).json({ error: "Failed to fetch notes" });
    }
});

//add or edit recipe notes
router.post("/", async (req, res) => {
    try {
        const { recipe_id, note } = req.body;
        const userId = await getUserIdFromAuth0(req.user.sub);

        const result = await pgclient.query(
            `INSERT INTO notes (user_id, recipe_id, note) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, recipe_id) 
             DO UPDATE SET note = $3
             RETURNING *`,
            [userId, recipe_id, note]
        );

        res.json({ message: "Note saved", note: result.rows[0] });
    } catch (error) {
        console.error("Error saving note:", error);
        res.status(500).json({ error: "Failed to save note" });
    }
});

export default router;