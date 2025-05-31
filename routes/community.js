import express from "express"
import pgclient from "../db.js";
import multer from "multer";
import { checkJwt, extractUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

//get all approved community recipes (public)
router.get("/", async (req, res) => {
    try {
        console.log('📖 GET /api/community - Public route accessed');
        const recipes = await pgclient.query(
            `SELECT cr.*, u.username as created_by_username 
             FROM community_recipes cr 
             LEFT JOIN "user" u ON cr.created_by = u.id 
             WHERE cr.approved = true 
             ORDER BY cr.created_at DESC`
        );
        res.json(recipes.rows);
    } catch (error) {
        console.error("Error fetching community recipes:", error);
        res.status(500).json({
            error: "Failed to fetch recipes",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

//get a specific recipe (public)
router.get("/:id", async (req, res) => {
    try {
        const recipeQuery = await pgclient.query(
            `SELECT cr.*, u.username as created_by_username 
             FROM community_recipes cr 
             LEFT JOIN "user" u ON cr.created_by = u.id 
             WHERE cr.id = $1 AND cr.approved = true`, 
            [req.params.id]
        );
        
        if (recipeQuery.rows.length === 0) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        const recipe = recipeQuery.rows[0];

        const ingredientsQuery = await pgclient.query(
            "SELECT ingredient FROM ingredients WHERE recipe_id = $1 ORDER BY id",
            [req.params.id]
        );

        const instructionsQuery = await pgclient.query(
            "SELECT step_number, instruction FROM instructions WHERE recipe_id = $1 ORDER BY step_number",
            [req.params.id]
        );

        recipe.ingredients = ingredientsQuery.rows;
        recipe.instructions = instructionsQuery.rows;

        res.json(recipe);
    } catch (error) {
        console.error("Error fetching recipe details:", error);
        res.status(500).json({
            error: "Failed to fetch recipe details",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

//get specific recipe image (public)
router.get("/:id/image", async (req, res) => {
    try {
        const result = await pgclient.query(
            "SELECT image_data, image_type FROM community_recipes WHERE id = $1 AND approved = true",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Image not found" });
        }

        const recipe = result.rows[0];
        
        if (!recipe.image_data) {
            return res.status(404).json({ message: "No image available" });
        }

        const mimeType = recipe.image_type || 'image/jpeg';
        
        res.set("Content-Type", mimeType);
        res.send(recipe.image_data);

    } catch (error) {
        console.error("Error fetching recipe image:", error);
        res.status(500).json({
            error: "Failed to fetch image",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

//create a community recipe (protected)
router.post("/", checkJwt, extractUser, upload.single("image"), async (req, res) => {
    const client = await pgclient.connect();

    try {
        const { title, prep_time, servings } = req.body;
        const imageData = req.file?.buffer;
        const imageType = req.file?.mimetype;
        
        console.log('🍳 Creating recipe with user:', req.user.id);
        console.log('📝 Recipe title:', title);
        console.log('⏱️ Prep time:', prep_time);
        console.log('🍽️ Servings:', servings);
        console.log('🖼️ Has image:', !!imageData);
        
        const userId = req.user.id;

        // Validation
        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title is required" });
        }

        if (!prep_time || prep_time <= 0) {
            return res.status(400).json({ error: "Valid prep time is required" });
        }

        if (!servings || servings <= 0) {
            return res.status(400).json({ error: "Valid number of servings is required" });
        }

        const ingredients = JSON.parse(req.body.ingredients || "[]");
        const instructions = JSON.parse(req.body.instructions || "[]");

        console.log('📋 Ingredients count:', ingredients.length);
        console.log('📖 Instructions count:', instructions.length);

        if (ingredients.length === 0 || instructions.length === 0) {
            return res.status(400).json({ error: "Ingredients and instructions are required" });
        }

        await client.query("BEGIN");

        const recipeResult = await client.query(
            `INSERT INTO community_recipes 
            (title, prep_time, servings, image_data, image_type, created_by, approved, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
            RETURNING id`,
            [title.trim(), parseInt(prep_time), parseInt(servings), imageData, imageType, userId]
        );

        const recipeId = recipeResult.rows[0].id;

        console.log('Recipe inserted with ID:', recipeId);

        //insert ingredients
        for (const ingredient of ingredients) {
            if (ingredient && ingredient.trim()) {
                await client.query(
                    `INSERT INTO ingredients (recipe_id, ingredient) VALUES ($1, $2)`,
                    [recipeId, ingredient.trim()]
                );
            }
        }

        //insert instructions
        let stepNumber = 1;
        for (const step of instructions) {
            if (step && step.trim()) {
                await client.query(
                    `INSERT INTO instructions (recipe_id, step_number, instruction) VALUES ($1, $2, $3)`,
                    [recipeId, stepNumber, step.trim()]
                );
                stepNumber++;
            }
        }

        await client.query("COMMIT");

        console.log(`Recipe created successfully with ID: ${recipeId}`);

        res.status(201).json({
            message: "Recipe created successfully and pending approval",
            recipe_id: recipeId
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error creating recipe:", err);
        console.error("Error details:", {
            message: err.message,
            code: err.code,
            detail: err.detail,
            where: err.where
        });
        res.status(500).json({
            error: "Failed to create recipe",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        client.release();
    }
});

//update a community recipe (protected)
router.put("/:id", checkJwt, extractUser, upload.single("image"), async (req, res) => {
    const client = await pgclient.connect();
    try {
        const { title, prep_time, servings } = req.body;
        const imageData = req.file?.buffer;
        const imageType = req.file?.mimetype;
        const ingredients = JSON.parse(req.body.ingredients || "[]");
        const instructions = JSON.parse(req.body.instructions || "[]");

        await client.query("BEGIN");

        if (imageData) {
            await client.query(
                `UPDATE community_recipes 
                 SET title = $1, prep_time = $2, servings = $3, image_data = $4, image_type = $5, updated_at = NOW() 
                 WHERE id = $6`,
                [title, parseInt(prep_time), parseInt(servings), imageData, imageType, req.params.id]
            );
        } else {
            await client.query(
                `UPDATE community_recipes 
                 SET title = $1, prep_time = $2, servings = $3, updated_at = NOW() 
                 WHERE id = $4`,
                [title, parseInt(prep_time), parseInt(servings), req.params.id]
            );
        }

        await client.query(`DELETE FROM ingredients WHERE recipe_id = $1`, [req.params.id]);
        await client.query(`DELETE FROM instructions WHERE recipe_id = $1`, [req.params.id]);

        for (const ingredient of ingredients) {
            if (ingredient && ingredient.trim()) {
                await client.query(
                    `INSERT INTO ingredients (recipe_id, ingredient) VALUES ($1, $2)`,
                    [req.params.id, ingredient.trim()]
                );
            }
        }

        let stepNumber = 1;
        for (const step of instructions) {
            if (step && step.trim()) {
                await client.query(
                    `INSERT INTO instructions (recipe_id, step_number, instruction) VALUES ($1, $2, $3)`,
                    [req.params.id, stepNumber, step.trim()]
                );
                stepNumber++;
            }
        }

        await client.query("COMMIT");
        res.status(200).json({ message: "Recipe updated successfully" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error updating recipe:", err);
        res.status(500).json({
            error: "Failed to update recipe",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        client.release();
    }
});

//delete a community recipe (protected)
router.delete("/:id", checkJwt, extractUser, async (req, res) => {
    try {
        const recipe = await pgclient.query(
            "DELETE FROM community_recipes WHERE id = $1 RETURNING *",
            [req.params.id]
        );

        if (recipe.rows.length === 0) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        res.json({
            message: "Recipe deleted successfully",
            recipe: recipe.rows[0],
        });

    } catch (err) {
        console.error("Error deleting recipe:", err);
        res.status(500).json({
            error: "Failed to delete recipe",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

//get all pending recipes (admin only)
router.get("/admin/pending", checkJwt, extractUser, requireAdmin, async (req, res) => {
    try {
        const recipes = await pgclient.query(
            `SELECT cr.*, u.username as created_by_username 
             FROM community_recipes cr 
             LEFT JOIN "user" u ON cr.created_by = u.id 
             WHERE cr.approved = false 
             ORDER BY cr.created_at ASC`
        );
        res.json(recipes.rows);
    } catch (error) {
        console.error("Error fetching pending recipes:", error);
        res.status(500).json({ error: "Failed to fetch pending recipes" });
    }
});

//approve/reject recipe (admin only)
router.patch("/:id/approval", checkJwt, extractUser, requireAdmin, async (req, res) => {
    try {
        const { approved } = req.body;
        
        const result = await pgclient.query(
            `UPDATE community_recipes 
             SET approved = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING *`,
            [approved, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        res.json({
            message: approved ? "Recipe approved" : "Recipe rejected",
            recipe: result.rows[0]
        });
    } catch (error) {
        console.error("Error updating recipe approval:", error);
        res.status(500).json({ error: "Failed to update recipe approval" });
    }
});

export default router;