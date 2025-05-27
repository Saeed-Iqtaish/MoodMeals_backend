import express from "express";
import pgclient from "../db.js";

const router = express.Router();

// Get notes for a recipe
router.get("/recipe/:recipeId/user/:userId", async (req, res) => {
    try {
        const { recipeId, userId } = req.params;
        
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

// Add or update note
router.post("/", async (req, res) => {
    try {
        const { user_id, recipe_id, note } = req.body;

        const result = await pgclient.query(
            `INSERT INTO notes (user_id, recipe_id, note) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, recipe_id) 
             DO UPDATE SET note = $3
             RETURNING *`,
            [user_id, recipe_id, note]
        );

        res.json({ message: "Note saved", note: result.rows[0] });
    } catch (error) {
        console.error("Error saving note:", error);
        res.status(500).json({ error: "Failed to save note" });
    }
});

// Delete note
router.delete("/", async (req, res) => {
    try {
        const { user_id, recipe_id } = req.body;

        const result = await pgclient.query(
            "DELETE FROM notes WHERE user_id = $1 AND recipe_id = $2",
            [user_id, recipe_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Note not found" });
        }

        res.json({ message: "Note deleted" });
    } catch (error) {
        console.error("Error deleting note:", error);
        res.status(500).json({ error: "Failed to delete note" });
    }
});

export default router;