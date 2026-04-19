require('dotenv').config();
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: false } }),
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'campusmarket',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'password123',
    });

// 20 realistic campus marketplace listings.
// Prices are ZAR second-hand estimates consistent with seedPrices.js ranges.
// Images are direct Unsplash photo URLs sized to 400×300.
const LISTINGS = [
  // ── Textbooks ─────────────────────────────────────────────────────────────
  {
    title:       'Calculus: Early Transcendentals 3rd Edition',
    description: 'Stewart Calculus used for MAT1512/MAT1613. Highlighted in chapters 1–5 only, otherwise clean.',
    price:       150,
    category:    'Textbooks',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Introduction to Psychology 11th Edition',
    description: 'Kalat textbook in good condition. A few pen marks on early chapters but all pages intact.',
    price:       100,
    category:    'Textbooks',
    type:        'sale',
    condition:   'fair',
    image:       'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Organic Chemistry 6th Edition – Clayden',
    description: 'Complete and unmarked copy of Clayden Organic Chemistry. Perfect for third-year chem students.',
    price:       380,
    category:    'Textbooks',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Engineering Mathematics Vol. 1 – Stroud',
    description: 'Well-maintained copy, minor cover wear. Covers algebra, calculus and complex numbers.',
    price:       200,
    category:    'Textbooks',
    type:        'sale',
    condition:   'fair',
    image:       'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Business Management 4th Edition – Nel et al.',
    description: 'Standard first-year BCom textbook. Looking to trade for an Accounting or Economics text.',
    price:       80,
    category:    'Textbooks',
    type:        'trade',
    condition:   'fair',
    image:       'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=300&fit=crop&auto=format',
  },

  // ── Electronics ───────────────────────────────────────────────────────────
  {
    title:       'Samsung Galaxy A54 5G (128GB, Black)',
    description: 'Excellent condition, no scratches. Comes with original charger and box. Battery health at 97%.',
    price:       3800,
    category:    'Electronics',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Sony WH-1000XM4 Wireless Headphones',
    description: 'Industry-leading noise cancellation. Purchased 8 months ago, used lightly. All accessories included.',
    price:       2800,
    category:    'Electronics',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Logitech MX Master 3 Wireless Mouse',
    description: 'Barely used — bought a new laptop with trackpad. Still in original box with USB receiver.',
    price:       850,
    category:    'Electronics',
    type:        'sale',
    condition:   'new',
    image:       'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'MacBook Air 65W USB-C Charger',
    description: 'Compatible with all USB-C MacBook Air and Pro models. No fraying, works perfectly.',
    price:       320,
    category:    'Electronics',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Xiaomi Mi Portable Bluetooth Speaker',
    description: 'Loud, clear sound with 10-hour battery life. Small scratch on the base, otherwise perfect.',
    price:       420,
    category:    'Electronics',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=300&fit=crop&auto=format',
  },

  // ── Furniture ─────────────────────────────────────────────────────────────
  {
    title:       'Solid Wood Study Desk (120cm)',
    description: 'Sturdy wooden desk with a single drawer. Light surface marks from use but very solid.',
    price:       600,
    category:    'Furniture',
    type:        'trade',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Adjustable Office / Study Chair',
    description: 'Height-adjustable padded chair with armrests. One wheel needs grease but spins fine.',
    price:       420,
    category:    'Furniture',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'IKEA KALLAX 4-Cube Bookshelf',
    description: 'White KALLAX unit in great shape. Easy to disassemble. Fits perfectly in a student room.',
    price:       350,
    category:    'Furniture',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Defy 60L Mini Bar Fridge',
    description: 'Works perfectly, keeps drinks cold. Small dent on the side. Ideal for a dorm room.',
    price:       900,
    category:    'Furniture',
    type:        'both',
    condition:   'fair',
    image:       'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Russell Hobbs 1.7L Kettle (White)',
    description: 'Barely used — moving out of res. Boils fast, no limescale build-up.',
    price:       120,
    category:    'Furniture',
    type:        'sale',
    condition:   'new',
    image:       'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop&auto=format',
  },

  // ── Clothing ──────────────────────────────────────────────────────────────
  {
    title:       'Nike Dri-FIT Hoodie (Size L, Grey)',
    description: 'Warm and comfortable. Washed and ready to go. A few washes in, still looks great.',
    price:       200,
    category:    'Clothing',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Levi\'s 511 Slim Jeans (W32 L30, Indigo)',
    description: 'Barely worn — wrong size for me. No tears or fading. Great everyday student jeans.',
    price:       280,
    category:    'Clothing',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Formal Navy Blazer (Men\'s M)',
    description: 'Used once for a campus presentation. Clean and freshly pressed. Open to trade or sale.',
    price:       320,
    category:    'Clothing',
    type:        'both',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=300&fit=crop&auto=format',
  },

  // ── Sports ────────────────────────────────────────────────────────────────
  {
    title:       'Adidas Running Shoes (Size 10, White/Black)',
    description: 'Worn for one semester of morning runs. Good grip remaining, cleaned and ready.',
    price:       480,
    category:    'Sports',
    type:        'sale',
    condition:   'good',
    image:       'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop&auto=format',
  },
  {
    title:       'Yoga Mat + Resistance Bands Set',
    description: 'Non-slip 6mm yoga mat with a set of 5 resistance bands. All in excellent condition.',
    price:       200,
    category:    'Sports',
    type:        'sale',
    condition:   'new',
    image:       'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=300&fit=crop&auto=format',
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    // Find the first user to use as seller.
    const { rows: users } = await client.query(
      'SELECT id FROM users ORDER BY created_at ASC LIMIT 1'
    );
    if (users.length === 0) {
      console.error('No users found in the database. Run the app and sign in once to create a user first.');
      process.exit(1);
    }
    const sellerId = users[0].id;
    console.log(`Using seller_id: ${sellerId}`);
    console.log(`Seeding ${LISTINGS.length} listings…`);

    await client.query('BEGIN');

    for (let i = 0; i < LISTINGS.length; i++) {
      const { title, description, price, category, type, condition, image } = LISTINGS[i];

      const { rows } = await client.query(
        `INSERT INTO listings (seller_id, title, description, price, category, type, condition, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id`,
        [sellerId, title, description, price, category, type, condition]
      );

      const listingId = rows[0].id;

      await client.query(
        `INSERT INTO listing_images (listing_id, image_url) VALUES ($1, $2)`,
        [listingId, image]
      );

      console.log(`  [${i + 1}/${LISTINGS.length}] "${title}" → ${listingId}`);
    }

    await client.query('COMMIT');
    console.log('Listing seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
