import express from "express";
import pgclient from "../db.js";

const notesRouter = express.Router();

//get notes for a specific recipe
notesRouter.get("/recipe/:recipeId", async (req, res) => {
    try {
        const { recipeId } = req.params;
        const userId = req.user.id;
        
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
notesRouter.post("/", async (req, res) => {
    try {
        const { recipe_id, note } = req.body;
        const userId = req.user.id;

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

export { notesRouter };