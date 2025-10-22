const express = require("express");
const pool = require("../../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
SELECT
    b.id,
    b.name,
    b.type,
    b.priority,
    b.background,
    b.active,
    b.hidden,
    b.created_at,
    json_agg(
        CASE
            -- If element is a number or object and banner type is list, fetch product
            WHEN b.type = 'list' AND (jsonb_typeof(elem) = 'number' OR jsonb_typeof(elem) = 'object') THEN
                (
                    SELECT json_build_object(
                        'id', p.id,
                        'name', p.name,
                        'description', p.description,
                        'price', p.price,
                        'endprice', p.endprice,
                        'stock', p.stock,
                        'primary_image', img.link,
                        'avg_rating', COALESCE(r.avg_rating,0),
                        'rating_count', COALESCE(r.rating_count,0)
                    )::jsonb
                    FROM public.product p
                    LEFT JOIN LATERAL (
                        SELECT link
                        FROM public.images i
                        WHERE i.product_id = p.id
                        ORDER BY i.priority ASC NULLS LAST, i.id ASC
                        LIMIT 1
                    ) img ON true
                    LEFT JOIN LATERAL (
                        SELECT AVG(value)::numeric(10,2) AS avg_rating,
                               COUNT(*) AS rating_count
                        FROM public.rating r
                        WHERE r.product_id = p.id
                    ) r ON true
                    WHERE p.id = 
                        CASE 
                            WHEN jsonb_typeof(elem) = 'number' THEN elem::int
                            ELSE (elem->>'id')::int
                        END
                )

            -- If element is a number and banner type is category, fetch category
            WHEN b.type = 'category' AND jsonb_typeof(elem) = 'number' THEN
                (
                    SELECT json_build_object(
                        'id', c.id,
                        'name', c.name,
                        'image', c.image
                    )::jsonb
                    FROM public.categories c
                    WHERE c.id = elem::int
                )

            -- Else return element as-is
            ELSE elem
        END
    ) AS map
FROM public.banner b
LEFT JOIN LATERAL 
    jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(b.map::jsonb) = 'array' THEN b.map::jsonb
            ELSE jsonb_build_array(b.map::jsonb)
        END
    ) elem ON true
WHERE b.active = true
GROUP BY b.id
ORDER BY b.priority ASC;



    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching banners:", err.message);
    res.status(500).json({ error: err.message });
  }
});
router.get("/product/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
SELECT
    b.id,
    b.name,
    b.type,
    b.priority,
    b.background,
    b.active,
    b.hidden,
    b.created_at,
    CASE
        -- ✅ TIMER banner logic
        WHEN b.type = 'timer' THEN COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'cta', elem->>'cta',
                    'title', elem->>'title',
                    'end_time', elem->>'end_time',
                    'products', (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', p.id,
                                'name', p.name,
                                'description', p.description,
                                'price', p.price,
                                'endprice', p.endprice,
                                'stock', p.stock,
                                'category_id', p.category_id,
                                'primary_image', img.link,
                                'avg_rating', COALESCE(r.avg_rating,0),
                                'rating_count', COALESCE(r.rating_count,0),
                                'created_at', p.created_at
                            )
                        )
                        FROM public.product p
                        LEFT JOIN LATERAL (
                            SELECT link
                            FROM public.images i
                            WHERE i.product_id = p.id
                            ORDER BY i.priority ASC NULLS LAST, i.id ASC
                            LIMIT 1
                        ) img ON true
                        LEFT JOIN LATERAL (
                            SELECT
                                AVG(value)::numeric(10,2) AS avg_rating,
                                COUNT(*) AS rating_count
                            FROM public.rating r
                            WHERE r.product_id = p.id
                        ) r ON true
                        WHERE p.id IN (
                            SELECT jsonb_array_elements_text(COALESCE(elem->'product_ids','[]'::jsonb))::int
                        )
                    )
                )
            ),
            '[]'::jsonb
        )

        -- ✅ LIST + CATEGORY types handled below
        ELSE jsonb_agg(
            CASE
                -- list-type: number → full product object
                WHEN b.type = 'list' AND jsonb_typeof(elem) = 'number' THEN
                    (
                        SELECT jsonb_build_object(
                            'id', p.id,
                            'name', p.name,
                            'description', p.description,
                            'price', p.price,
                            'endprice', p.endprice,
                            'stock', p.stock,
                            'category_id', p.category_id,
                            'primary_image', img.link,
                            'avg_rating', COALESCE(r.avg_rating, 0),
                            'rating_count', COALESCE(r.rating_count, 0),
                            'created_at', p.created_at
                        )
                        FROM public.product p
                        LEFT JOIN LATERAL (
                            SELECT link
                            FROM public.images i
                            WHERE i.product_id = p.id
                            ORDER BY i.priority ASC NULLS LAST, i.id ASC
                            LIMIT 1
                        ) img ON true
                        LEFT JOIN LATERAL (
                            SELECT
                                AVG(value)::numeric(10,2) AS avg_rating,
                                COUNT(*) AS rating_count
                            FROM public.rating r
                            WHERE r.product_id = p.id
                        ) r ON true
                        WHERE p.id = elem::int
                    )::jsonb

                -- list-type: object (already expanded)
                WHEN b.type = 'list' AND jsonb_typeof(elem) = 'object' THEN
                    (
                        SELECT jsonb_build_object(
                            'id', p.id,
                            'name', p.name,
                            'description', p.description,
                            'price', p.price,
                            'endprice', p.endprice,
                            'stock', p.stock,
                            'category_id', p.category_id,
                            'primary_image', img.link,
                            'avg_rating', COALESCE(r.avg_rating, 0),
                            'rating_count', COALESCE(r.rating_count, 0),
                            'created_at', p.created_at
                        )
                        FROM public.product p
                        LEFT JOIN LATERAL (
                            SELECT link
                            FROM public.images i
                            WHERE i.product_id = p.id
                            ORDER BY i.priority ASC NULLS LAST, i.id ASC
                            LIMIT 1
                        ) img ON true
                        LEFT JOIN LATERAL (
                            SELECT
                                AVG(value)::numeric(10,2) AS avg_rating,
                                COUNT(*) AS rating_count
                            FROM public.rating r
                            WHERE r.product_id = p.id
                        ) r ON true
                        WHERE p.id = (elem->>'id')::int
                    )::jsonb

                -- category-type
                WHEN b.type = 'category' AND jsonb_typeof(elem) = 'number' THEN
                    (
                        SELECT jsonb_build_object(
                            'id', c.id,
                            'name', c.name,
                            'image', c.image
                        )
                        FROM public.categories c
                        WHERE c.id = elem::int
                    )::jsonb

                ELSE elem::jsonb
            END
        )
    END AS map
FROM public.banner b
LEFT JOIN LATERAL
    jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(b.map::jsonb) = 'array' THEN b.map::jsonb
            ELSE jsonb_build_array(b.map::jsonb)
        END
    ) elem ON true
WHERE b.id = $1
GROUP BY b.id
ORDER BY b.priority ASC;
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching banner products:", err.message);
    res.status(500).json({ error: err.message });
  }
});




// Get one banner by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM public.banner WHERE id = $1 AND active = true",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).send(" banner not found");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
//post banners
router.post("/", async (req, res) => {
  const { name, priority, active, type, map, background, hidden, created_at } =
    req.body;
  try {
    const result = await pool.query(
      "INSERT INTO banner (name , priority, active, type, map , background, hidden, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [name, priority, active, type, map, background, hidden, created_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Update banner by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, priority, active, type, map, background, hidden } = req.body;

  try {
    const result = await pool.query(
      `UPDATE banner 
       SET name = $1, priority = $2, active = $3, type = $4, map = $5, background = $6, hidden = $7
       WHERE id = $8 RETURNING *`,
      [name, priority, active, type, map, background, hidden, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Banner not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error while updating banner:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

// Delete banner by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM public.banner WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Banner not found");
    }

    res.send(`✅ Banner with id ${id} deleted successfully`);
  } catch (err) {
    console.error("❌ Error while deleting banner:", err.message);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

module.exports = router;
