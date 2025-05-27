import express from "express"
import pgclient from "../db.js";
import multer from "multer";

const router = express.Router();


//get all community recipes
router.get("/", async (req, res) => {
    try {
        const recipes = await pgclient.query("SELECT * from community_recipes")
        res.json(recipes.rows);
    } catch (error) {
        console.error("Detailed error:", {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({
            error: "Internal server error",
            details: error.message
        });
    }
});

//get a specific recipe by ID with ingredient and instructions
router.get("/:id", async (req, res) => {
    try {
        const recipe = await pgclient.query("SELECT * from community_recipes WHERE id = $1", [req.params.id]);
        if (recipe.rows.length === 0) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        const ingredientsQuery = await pgclient.query(
            "SELECT ingredient FROM ingredients WHERE recipe_id = $1 ORDER BY id",
            [req.params.id]
        );
s
        const instructionsQuery = await pgclient.query(
            "SELECT step_number, instruction FROM instructions WHERE recipe_id = $1 ORDER BY step_number",
            [req.params.id]
        );

        recipe.ingredients = ingredientsQuery.rows;
        recipe.instructions = instructionsQuery.rows;

        res.json(recipe);
    } catch (error) {
        console.error("Detailed error:", {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({
            error: "Internal server error",
            details: error.message
        });
    }
});

//get specific recipe image
router.get("/:id/image", async (req, res) => {
    try {
        const result = pgclient.query(
            "SELECT image_data, image_type from community_recipes WHERE id = $1 AND approved = true"
            , [req.params.id]
        );

        const mimeType = recipe.image_type;
        res.set("Content-Type", mimeType);
        res.send(recipe.image_data);

    } catch (error) {
        console.error("Detailed error:", {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({
            error: "Internal server error",
            details: error.message
        });
    }
});


//set up Multer to store files in memory for image uploads for creating community recipes
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

//create a community recipe
router.post("/", upload.single("image"), async (req, res) => {
    const client = await pgclient.connect();

    try {
        const { title, created_by } = req.body;
        const imageData = req.file?.buffer;
        const imageType = req.file?.mimetype;

        const ingredients = JSON.parse(req.body.ingredients || "[]");
        const instructions = JSON.parse(req.body.instructions || "[]");

        await client.query("BEGIN");

        const recipeResult = await client.query(
            `INSERT INTO community_recipes 
        (title, image_data, image_type, created_by, approved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, false, NOW(), NOW())
       RETURNING id`,
            [title, imageData, imageType, created_by]
        );

        const recipeId = recipeResult.rows[0].id;

        for (const ingredient of ingredients) {
            await client.query(
                `INSERT INTO ingredients (recipe_id, ingredient)
         VALUES ($1, $2)`,
                [recipeId, ingredient]
            );
        }

        let stepNumber = 1;
        for (const step of instructions) {
            await client.query(
                `INSERT INTO instructions (recipe_id, step_number, instruction) VALUES ($1, $2, $3)`,
                [recipeId, stepNumber, step]
            );
            stepNumber++;
        }


        await client.query("COMMIT");

        res.status(201).json({
            message: "Recipe created successfully",
            recipe_id: recipeId
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Detailed error:", {
            message: err.message,
            stack: err.stack,
            code: err.code
        });
        res.status(500).json({
            error: "Internal server error",
            details: err.message
        });
    } finally {
        client.release();
    }
});

//update a community recipe
router.put("/:id", upload.single("image"), async (req, res) => {
  const client = await pgclient.connect();
  try {
    const { title } = req.body;
    const imageData = req.file?.buffer;
    const imageType = req.file?.mimetype;
    const ingredients = JSON.parse(req.body.ingredients || "[]");
    const instructions = JSON.parse(req.body.instructions || "[]");

    await client.query("BEGIN");

    await client.query(
      `UPDATE community_recipes SET title = $1, image_data = $2, image_type = $3, updated_at = NOW() WHERE id = $4`,
      [title, imageData, imageType, req.params.id]
    );

    await client.query(`DELETE FROM ingredients WHERE recipe_id = $1`, [req.params.id]);
    await client.query(`DELETE FROM instructions WHERE recipe_id = $1`, [req.params.id]);

    for (const ingredient of ingredients) {
      await client.query(
        `INSERT INTO ingredients (recipe_id, ingredient) VALUES ($1, $2)`,
        [req.params.id, ingredient]
      );
    }

    let stepNumber = 1;
    for (const step of instructions) {
      await client.query(
        `INSERT INTO instructions (recipe_id, step_number, instruction) VALUES ($1, $2, $3)`,
        [req.params.id, stepNumber, step]
      );
      stepNumber++;
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Recipe updated successfully" });

  } catch (err) {
        await client.query("ROLLBACK");
        console.error("Detailed error:", {
            message: err.message,
            stack: err.stack,
            code: err.code
        });
        res.status(500).json({
            error: "Internal server error",
            details: err.message
        });
  } finally {
    client.release();
  }
});

//delete a community recipe
router.delete("/:id", async (req, res) => {
  try {
    const recipe = await pgclient.query(
      "DELETE from community_recipes WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (recipe.rows.length === 0) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    res.json({
      message: "Recipe deleted",
      recipe: recipe.rows[0],
    });

  } catch (err) {
    console.error("Detailed error:", {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
});

export default router;