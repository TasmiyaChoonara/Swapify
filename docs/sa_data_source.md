# SA Data Source Documentation

## Chosen Data Source

**Source Name:** South African Retail Price Research (Curated)  
**Primary References:**
- Takealot.com — SA's largest online retailer (electronics, textbooks)
- Loot.co.za — SA online bookstore (textbooks)
- OLX South Africa — SA second-hand marketplace (furniture, clothing, sports)
- Facebook Marketplace ZA — SA peer-to-peer sales (furniture, clothing)
- PNA / Campus bookshops — stationery and textbooks
- Checkers / Game / Incredible Connection — appliances and electronics

## Why This Source Was Chosen

Stats SA (statssa.gov.za) publishes Consumer Price Index (CPI) data only as Excel/PDF downloads with no public REST API. The data covers aggregate price indices, not per-item retail prices relevant to student resale.

data.gov.za has no product-level retail price data suitable for campus marketplace categories.

The World Bank API covers SA aggregate CPI indices only, not individual item prices.

**Decision:** Manually curated seed data researched from real SA retail and second-hand sources listed above. All prices reflect typical second-hand student resale values in ZAR, covering the six categories most relevant to campus trading: electronics, textbooks, furniture, clothing, sports, and other.

## Data Structure

Stored in the `price_references` table:

| Column | Type | Description |
|--------|------|-------------|
| category | VARCHAR | Item category (electronics, textbooks, etc.) |
| item_type | VARCHAR | Specific item description |
| min_price | DECIMAL | Minimum resale price in ZAR |
| median_price | DECIMAL | Typical resale price in ZAR |
| max_price | DECIMAL | Maximum resale price in ZAR |
| currency | CHAR(3) | Always ZAR |
| source | TEXT | Data source description |
| last_updated | TIMESTAMP | When data was last updated |

## Reliability Justification

1. All sources are legitimate, publicly accessible SA platforms
2. Prices reflect real SA market conditions in ZAR
3. Data covers 65 item types across 6 categories relevant to students
4. The `last_updated` column allows data to be refreshed annually
5. The `source` column on every row maintains full traceability
6. Using median price rather than average reduces the effect of outliers

## How It Is Used

The `GET /api/prices/suggest` endpoint accepts a category and item description, performs a fuzzy match against the price_references table, and returns a suggested price range to display in the Create Listing form. This helps students price their items competitively based on real SA market data.

## Update Schedule

Prices should be reviewed and updated annually. To update, modify `scripts/seedPrices.js` and re-run `npm run seed:prices`. The upsert query ensures existing rows are updated without duplicates.
