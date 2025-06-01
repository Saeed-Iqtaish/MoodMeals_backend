import express from "express";
import pgclient from "../db.js";

const router = express.Router();

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

router.post("/", async (req, res) => {
    try {
        const { recipe_id, is_community = false } = req.body;
        const userId = req.user.id;

        if (!recipe_id) {
            return res.status(400).json({ error: "Recipe ID is required" });
        }

        const recipeIdNum = parseInt(recipe_id);
        if (isNaN(recipeIdNum) || recipeIdNum <= 0) {
            return res.status(400).json({ error: "Invalid recipe ID" });
        }

        const existing = await pgclient.query(
            "SELECT * FROM favorites WHERE user_id = $1 AND recipe_id = $2 AND is_community = $3",
            [userId, recipeIdNum, is_community]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Recipe already in favorites" });
        }

        if (is_community) {
            const communityRecipe = await pgclient.query(
                "SELECT id FROM community_recipes WHERE id = $1 AND approved = true",
                [recipeIdNum]
            );

            if (communityRecipe.rows.length === 0) {
                return res.status(404).json({ 
                    error: "Community recipe not found or not approved" 
                });
            }
        }


        await pgclient.query(
            "INSERT INTO favorites (user_id, recipe_id, is_community) VALUES ($1, $2, $3)",
            [userId, recipeIdNum, is_community]
        );

        console.log(`✅ Recipe ${recipeIdNum} (${is_community ? 'community' : 'API'}) added to favorites for user ${userId}`);

        res.status(201).json({ 
            message: "Recipe added to favorites",
            recipe_id: recipeIdNum,
            is_community
        });
    } catch (error) {
        console.error("Error adding to favorites:", error);
        
        if (error.code === '23505') {
            return res.status(400).json({ error: "Recipe already in favorites" });
        }
        
        if (error.code === '23503') {
            return res.status(400).json({ 
                error: "Database constraint error - please contact support",
                details: "The foreign key constraint should be removed for API recipes"
            });
        }

        res.status(500).json({ 
            error: "Failed to add to favorites",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.delete("/", async (req, res) => {
    try {
        const { recipe_id, is_community = false } = req.body;
        const userId = req.user.id;

        if (!recipe_id) {
            return res.status(400).json({ error: "Recipe ID is required" });
        }

        const recipeIdNum = parseInt(recipe_id);
        if (isNaN(recipeIdNum) || recipeIdNum <= 0) {
            return res.status(400).json({ error: "Invalid recipe ID" });
        }

        const result = await pgclient.query(
            "DELETE FROM favorites WHERE user_id = $1 AND recipe_id = $2 AND is_community = $3",
            [userId, recipeIdNum, is_community]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Favorite not found" });
        }

        console.log(`✅ Recipe ${recipeIdNum} (${is_community ? 'community' : 'API'}) removed from favorites for user ${userId}`);

        res.json({ 
            message: "Recipe removed from favorites",
            recipe_id: recipeIdNum,
            is_community
        });
    } catch (error) {
        console.error("Error removing from favorites:", error);
        res.status(500).json({ 
            error: "Failed to remove from favorites",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get("/check/:recipeId", async (req, res) => {
    try {
        const { recipeId } = req.params;
        const { is_community = 'false' } = req.query;
        const userId = req.user.id;
        
        const recipeIdNum = parseInt(recipeId);
        if (isNaN(recipeIdNum) || recipeIdNum <= 0) {
            return res.status(400).json({ error: "Invalid recipe ID" });
        }

        const isCommunityBool = is_community === 'true';

        const favorite = await pgclient.query(
            "SELECT * FROM favorites WHERE user_id = $1 AND recipe_id = $2 AND is_community = $3",
            [userId, recipeIdNum, isCommunityBool]
        );

        res.json({ 
            isFavorited: favorite.rows.length > 0,
            recipe_id: recipeIdNum,
            is_community: isCommunityBool
        });
    } catch (error) {
        console.error("Error checking favorite status:", error);
        res.status(500).json({ 
            error: "Failed to check favorite status",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;