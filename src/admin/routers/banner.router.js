const express = require("express");
const pool = require("../../../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;

  try {
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    // 1️⃣ Count total banners
    const countResult = await pool.query("SELECT COUNT(*) FROM public.banner");
    const total = parseInt(countResult.rows[0].count, 10);

    // 2️⃣ Fetch paginated banners
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
        json_agg(
          CASE
            WHEN jsonb_typeof(elem) = 'number' AND b.type = 'list' THEN
              (
                SELECT json_agg(
                  json_build_object(
                    'id', p.id,
                    'name', p.name,
                    'description', p.description,
                    'price', p.price,
                    'endprice', p.endprice,
                    'primary_image', img.link,
                    'avg_rating', COALESCE(r.avg_rating,0),
                    'rating_count', COALESCE(r.rating_count,0)
                  )::jsonb
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
                  SELECT AVG(value)::numeric(10,2) AS avg_rating,
                         COUNT(*) AS rating_count
                  FROM public.rating r
                  WHERE r.product_id = p.id
                ) r ON true
                WHERE p.id = elem::int
              )::jsonb
            WHEN jsonb_typeof(elem) = 'number' AND b.type = 'category' THEN
              (
                SELECT json_build_object(
                  'id', c.id,
                  'name', c.name,
                  'image', c.image
                )::jsonb
                FROM public.categories c
                WHERE c.id = elem::int
              )
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
      GROUP BY b.id
      ORDER BY b.priority ASC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    res.json({
      data: result.rows,
      total,
      page: Number(page),
      pageSize: limit,
    });
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
        WHEN b.type = 'timer' THEN COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'cta', m.elem->>'cta',
                    'title', m.elem->>'title',
                    'end_time', m.elem->>'end_time',
                    'products', COALESCE(p.products,'[]'::jsonb)
                )
            ),
            '[]'::jsonb
        )
        ELSE COALESCE(
            jsonb_agg(
                CASE
                    WHEN jsonb_typeof(elem) = 'number' AND b.type = 'list' THEN
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', p.id,
                                    'name', p.name,
                                    'description', p.description,
                                    'price', p.price,
                                    'endprice', p.endprice,
                                    'primary_image', img.link,
                                    'avg_rating', COALESCE(r.avg_rating,0),
                                    'rating_count', COALESCE(r.rating_count,0)
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
                                SELECT AVG(value)::numeric(10,2) AS avg_rating,
                                       COUNT(*) AS rating_count
                                FROM public.rating r
                                WHERE r.product_id = p.id
                            ) r ON true
                            WHERE p.id = elem::int
                        )
                    WHEN jsonb_typeof(elem) = 'number' AND b.type = 'category' THEN
                        (
                            SELECT jsonb_build_object(
                                'id', c.id,
                                'name', c.name,
                                'image', c.image
                            )
                            FROM public.categories c
                            WHERE c.id = elem::int
                        )
                    ELSE elem
                END
            ),
            '[]'::jsonb
        )
    END AS map
FROM public.banner b
-- Loop over map array safely
LEFT JOIN LATERAL jsonb_array_elements(COALESCE(b.map,'[]'::jsonb)) AS m(elem) ON true
-- Fetch products for timer banners
LEFT JOIN LATERAL (
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'price', p.price,
            'endprice', p.endprice,
            'primary_image', img.link,
            'avg_rating', COALESCE(r.avg_rating,0),
            'rating_count', COALESCE(r.rating_count,0)
        )
    ) AS products
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
    WHERE p.id IN (
        SELECT jsonb_array_elements_text(COALESCE(m.elem->'product_ids','[]'::jsonb))::int
    )
) p ON true
WHERE b.id = $1
GROUP BY b.id
ORDER BY b.priority ASC;
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching banner:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get one banner by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM public.banner WHERE id = $1", [id]);
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

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    // Build dynamic update set
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(data)) {
      if (key === "map" && Array.isArray(value)) {
        fields.push(`${key} = $${index++}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${index++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const query = `
      UPDATE banner 
      SET ${fields.join(", ")} 
      WHERE id = $${index} 
      RETURNING *;
    `;

    values.push(id);
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).send("❌ Banner not found");
    }

    const updated = result.rows[0];
    if (updated.map && typeof updated.map === "string") {
      updated.map = JSON.parse(updated.map);
    }

    res.json(updated);
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
