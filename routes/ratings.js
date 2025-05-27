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

//get ratings for a recipe
router.get("/recipe/:recipeId", async (req, res) => {
    try {
        const { recipeId } = req.params;
        
        const ratings = await pgclient.query(
            `SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
             FROM rating WHERE recipe_id = $1`,
            [recipeId]
        );

        res.json({
            average_rating: parseFloat(ratings.rows[0].average_rating) || 0,
            total_ratings: parseInt(ratings.rows[0].total_ratings)
        });
    } catch (error) {
        console.error("Error fetching ratings:", error);
        res.status(500).json({ error: "Failed to fetch ratings" });
    }
});

//add or update rating
router.post("/", async (req, res) => {
    try {
        const { recipe_id, rating } = req.body;
        const userId = await getUserIdFromAuth0(req.user.sub);

        //validate rating (1-5)
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5" });
        }

        const result = await pgclient.query(
            `INSERT INTO rating (user_id, recipe_id, rating) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, recipe_id) 
             DO UPDATE SET rating = $3
             RETURNING *`,
            [userId, recipe_id, rating]
        );

        res.json({ message: "Rating saved", rating: result.rows[0] });
    } catch (error) {
        console.error("Error saving rating:", error);
        res.status(500).json({ error: "Failed to save rating" });
    }
});

export default router;
