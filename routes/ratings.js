import express from "express";
import pgclient from "../db.js";

const router = express.Router();

router.get("/recipe/:recipeId", async (req, res) => {
    try {
        const { recipeId } = req.params;
        const userId = req.user?.id;

        const ratings = await pgclient.query(
            `SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
             FROM rating WHERE recipe_id = $1`,
            [recipeId]
        );

        let userRating = null;

        if (userId) {
            const userRatingResult = await pgclient.query(
                `SELECT rating FROM rating WHERE recipe_id = $1 AND user_id = $2`,
                [recipeId, userId]
            );

            if (userRatingResult.rows.length > 0) {
                userRating = userRatingResult.rows[0].rating;
            }
        }

        res.json({
            average_rating: parseFloat(ratings.rows[0].average_rating) || 0,
            total_ratings: parseInt(ratings.rows[0].total_ratings),
            user_rating: userRating
        });
    } catch (error) {
        console.error("Error fetching ratings:", error);
        res.status(500).json({ error: "Failed to fetch ratings" });
    }
});

router.post("/", async (req, res) => {
    try {
        const { recipe_id, rating } = req.body;
        const userId = req.user.id;

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" });
        }

        const recipeCheck = await pgclient.query(
            "SELECT id FROM community_recipes WHERE id = $1 AND approved = true",
            [recipe_id]
        );

        if (recipeCheck.rows.length === 0) {
            return res.status(404).json({ error: "Recipe not found or not approved" });
        }

        const result = await pgclient.query(
            `INSERT INTO rating (user_id, recipe_id, rating) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, recipe_id) 
             DO UPDATE SET rating = $3
             RETURNING *`,
            [userId, recipe_id, rating]
        );

        console.log(`User ${userId} rated recipe ${recipe_id} with ${rating} stars`);

        res.json({ message: "Rating saved", rating: result.rows[0] });
    } catch (error) {
        console.error("Error saving rating:", error);
        res.status(500).json({ error: "Failed to save rating" });
    }
});

router.get("/user/:recipeId", async (req, res) => {
    try {
        const { recipeId } = req.params;
        const userId = req.user.id;

        const result = await pgclient.query(
            "SELECT rating FROM rating WHERE user_id = $1 AND recipe_id = $2",
            [userId, recipeId]
        );

        res.json({
            rating: result.rows.length > 0 ? result.rows[0].rating : null
        });
    } catch (error) {
        console.error("Error fetching user rating:", error);
        res.status(500).json({ error: "Failed to fetch user rating" });
    }
});

export default router;