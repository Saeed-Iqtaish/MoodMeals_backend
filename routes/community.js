import express from "express"
import pgclient from "../db.js";
import multer from "multer";
import { checkJwt, extractUser } from '../middleware/auth0.js';

const router = express.Router();

async function getUserIdFromAuth0(auth0Id) {
    if (!auth0Id) {
        throw new Error("Auth0 ID is required");
    }
    
    const userResult = await pgclient.query(
        'SELECT id FROM "user" WHERE auth0_id = $1',
        [auth0Id]
    );
    
    if (userResult.rows.length === 0) {
        throw new Error("User not found");
    }
    
    return userResult.rows[0].id;
}

// Set up Multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// PUBLIC ROUTES - No authentication required

// Get all approved community recipes (PUBLIC)
router.get("/", async (req, res) => {
    try {
        console.log('📖 GET /api/community - Public route accessed');
        const recipes = await pgclient.query(
            "SELECT * FROM community_recipes WHERE approved = true ORDER BY created_at DESC"
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

// Get a specific recipe by ID with ingredients and instructions (PUBLIC)
router.get("/:id", async (req, res) => {
    try {
        const recipeQuery = await pgclient.query(
            "SELECT * FROM community_recipes WHERE id = $1 AND approved = true", 
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

// Get specific recipe image (PUBLIC)
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

// Create a community recipe (PROTECTED)
router.post("/", (req, res, next) => {
    console.log('🔒 POST /api/community - Protected route accessed');
    console.log('🔍 Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
    
    // Apply authentication
    checkJwt(req, res, (err) => {
        if (err) {
            console.log('❌ JWT verification failed:', err.message);
            return res.status(401).json({
                error: "Authentication failed",
                message: err.message
            });
        }
        
        console.log('✅ JWT verified for recipe creation');
        extractUser(req, res, (err) => {
            if (err) {
                console.log('❌ User extraction failed:', err.message);
                return res.status(500).json({
                    error: "User extraction failed",
                    message: err.message
                });
            }
            
            console.log('✅ User extracted for recipe creation:', req.user?.sub);
            next();
        });
    });
}, upload.single("image"), async (req, res) => {
    const client = await pgclient.connect();

    try {
        const { title } = req.body;
        const imageData = req.file?.buffer;
        const imageType = req.file?.mimetype;
        
        console.log('🍳 Creating recipe with user:', req.user.sub);
        console.log('📝 Recipe title:', title);
        console.log('🖼️ Has image:', !!imageData);
        
        // Get user info from Auth0 token
        const userId = await getUserIdFromAuth0(req.user.sub);
        const created_by = req.user.name || req.user.email || `user_${req.user.sub.split('|')[1] || req.user.sub}`;

        console.log('👤 User ID from DB:', userId, 'Type:', typeof userId);
        console.log('📝 Created by name:', created_by, 'Type:', typeof created_by);

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title is required" });
        }

        const ingredients = JSON.parse(req.body.ingredients || "[]");
        const instructions = JSON.parse(req.body.instructions || "[]");

        console.log('📋 Ingredients count:', ingredients.length);
        console.log('📖 Instructions count:', instructions.length);

        if (ingredients.length === 0 || instructions.length === 0) {
            return res.status(400).json({ error: "Ingredients and instructions are required" });
        }

        await client.query("BEGIN");

        // First, let's check the table structure
        const tableInfo = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'community_recipes' 
            ORDER BY ordinal_position
        `);
        
        console.log('🗄️ Table structure:', tableInfo.rows);

        // Try the insert with just the string created_by field
        const recipeResult = await client.query(
            `INSERT INTO community_recipes 
            (title, image_data, image_type, created_by, approved, created_at, updated_at)
            VALUES ($1, $2, $3, $4, false, NOW(), NOW())
            RETURNING id`,
            [title.trim(), imageData, imageType, created_by]
        );

        const recipeId = recipeResult.rows[0].id;

        console.log('✅ Recipe inserted with ID:', recipeId);

        // Insert ingredients
        for (const ingredient of ingredients) {
            if (ingredient && ingredient.trim()) {
                await client.query(
                    `INSERT INTO ingredients (recipe_id, ingredient) VALUES ($1, $2)`,
                    [recipeId, ingredient.trim()]
                );
            }
        }

        // Insert instructions
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

        console.log(`✅ Recipe created successfully with ID: ${recipeId}`);

        res.status(201).json({
            message: "Recipe created successfully and pending approval",
            recipe_id: recipeId
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Error creating recipe:", err);
        console.error("❌ Error details:", {
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

// Update a community recipe (PROTECTED)
router.put("/:id", checkJwt, extractUser, upload.single("image"), async (req, res) => {
    const client = await pgclient.connect();
    try {
        const { title } = req.body;
        const imageData = req.file?.buffer;
        const imageType = req.file?.mimetype;
        const ingredients = JSON.parse(req.body.ingredients || "[]");
        const instructions = JSON.parse(req.body.instructions || "[]");

        await client.query("BEGIN");

        // Only update image if new one is provided
        if (imageData) {
            await client.query(
                `UPDATE community_recipes SET title = $1, image_data = $2, image_type = $3, updated_at = NOW() WHERE id = $4`,
                [title, imageData, imageType, req.params.id]
            );
        } else {
            await client.query(
                `UPDATE community_recipes SET title = $1, updated_at = NOW() WHERE id = $2`,
                [title, req.params.id]
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

// Delete a community recipe (PROTECTED)
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

export default router;