import express from "express";
import pgclient from "../db.js";

const router = express.Router();

// Get all favorites for authenticated user
router.get("/", async (req, res) => {
    try {
        const userId = req.user.id;
        
        const favorites = await pgclient.query(
            "SELECT recipe_id, is_community FROM favorites WHERE user_id = $1",
            [userId]
        );
        
        res.json(favorites.rows);
    } catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).json({ error: "Failed to fetch favorites" });
    }
});

// Add a recipe to favorites
router.post("/", async (req, res) => {
    try {
        const { recipe_id, is_community = false } = req.body;
        const userId = req.user.id;

        // Check if already in favorites
        const existing = await pgclient.query(
            "SELECT * FROM favorites WHERE user_id = $1 AND recipe_id = $2 AND is_community = $3",
            [userId, recipe_id, is_community]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Recipe already in favorites" });
        }

        // Add to favorites
        await pgclient.query(
            "INSERT INTO favorites (user_id, recipe_id, is_community) VALUES ($1, $2, $3)",
            [userId, recipe_id, is_community]
        );

        res.status(201).json({ 
            message: "Recipe added to favorites",
            recipe_id,
            is_community
        });
    } catch (error) {
        console.error("Error adding to favorites:", error);
        res.status(500).json({ error: "Failed to add to favorites" });
    }
});

// Remove a recipe from favorites
router.delete("/", async (req, res) => {
    try {
        const { recipe_id, is_community = false } = req.body;
        const userId = req.user.id;

        const result = await pgclient.query(
            "DELETE FROM favorites WHERE user_id = $1 AND recipe_id = $2 AND is_community = $3",
            [userId, recipe_id, is_community]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Favorite not found" });
        }

        res.json({ 
            message: "Recipe removed from favorites",
            recipe_id,
            is_community
        });
    } catch (error) {
        console.error("Error removing from favorites:", error);
        res.status(500).json({ error: "Failed to remove from favorites" });
    }
});

// Check if a specific recipe is favorited
router.get("/check/:recipeId", async (req, res) => {
    try {
        const { recipeId } = req.params;
        const { is_community = 'false' } = req.query;
        const userId = req.user.id;
        
        // Convert string to boolean
        const isCommunityBool = is_community === 'true';

        const favorite = await pgclient.query(
            "SELECT * FROM favorites WHERE user_id = $1 AND recipe_id = $2 AND is_community = $3",
            [userId, recipeId, isCommunityBool]
        );

        res.json({ 
            isFavorited: favorite.rows.length > 0,
            recipe_id: recipeId,
            is_community: isCommunityBool
        });
    } catch (error) {
        console.error("Error checking favorite status:", error);
        res.status(500).json({ error: "Failed to check favorite status" });
    }
});

export default router;