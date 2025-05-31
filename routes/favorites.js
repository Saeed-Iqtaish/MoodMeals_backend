import express from "express";
import pgclient from "../db.js";

const router = express.Router();

//get all favorites for authenticated user
router.get("/", async (req, res) => {
    try {
        const userId = req.user.id;
        
        const favorites = await pgclient.query(
            "SELECT recipe_id FROM favorites WHERE user_id = $1",
            [userId]
        );
        
        res.json(favorites.rows);
    } catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).json({ error: "Failed to fetch favorites" });
    }
});

//add a recipe to favorites
router.post("/", async (req, res) => {
    try {
        const { recipe_id } = req.body;
        const userId = req.user.id;

        const existing = await pgclient.query(
            "SELECT * FROM favorites WHERE user_id = $1 AND recipe_id = $2",
            [userId, recipe_id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Recipe already in favorites" });
        }

        await pgclient.query(
            "INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)",
            [userId, recipe_id]
        );

        res.status(201).json({ message: "Recipe added to favorites" });
    } catch (error) {
        console.error("Error adding to favorites:", error);
        res.status(500).json({ error: "Failed to add to favorites" });
    }
});

//remove a recipe from favorites
router.delete("/", async (req, res) => {
    try {
        const { recipe_id } = req.body;
        const userId = req.user.id;

        const result = await pgclient.query(
            "DELETE FROM favorites WHERE user_id = $1 AND recipe_id = $2",
            [userId, recipe_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Favorite not found" });
        }

        res.json({ message: "Recipe removed from favorites" });
    } catch (error) {
        console.error("Error removing from favorites:", error);
        res.status(500).json({ error: "Failed to remove from favorites" });
    }
});

export default router;