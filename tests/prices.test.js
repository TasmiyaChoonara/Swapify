'use strict';

jest.mock('../src/models/priceReference');

const priceModel = require('../src/models/priceReference');
const priceService = require('../src/services/priceService');

beforeEach(() => jest.clearAllMocks());

// ─── suggestPrice ─────────────────────────────────────────────────────────────

describe('priceService.suggestPrice', () => {
  test('throws 400 when category is missing', async () => {
    await expect(priceService.suggestPrice(undefined, 'laptop')).rejects.toMatchObject({ status: 400 });
    await expect(priceService.suggestPrice('', 'laptop')).rejects.toMatchObject({ status: 400 });
  });

  test('returns null when category has no seed data', async () => {
    priceModel.findByCategoryAndItem.mockResolvedValue([]);
    priceModel.getCategoryRange.mockResolvedValue({ min_price: null, median_price: null, max_price: null });
    const result = await priceService.suggestPrice('unknowncategory', 'widget');
    expect(result).toBeNull();
  });

  test('returns null when category has no data and item omitted', async () => {
    priceModel.getCategoryRange.mockResolvedValue(null);
    const result = await priceService.suggestPrice('emptycategory');
    expect(result).toBeNull();
  });

  test('returns category range when item param omitted', async () => {
    priceModel.getCategoryRange.mockResolvedValue({
      min_price: '100', median_price: '250', max_price: '500',
    });
    const result = await priceService.suggestPrice('electronics');
    expect(result).toMatchObject({
      category: 'electronics',
      min: 100,
      median: 250,
      max: 500,
      currency: 'ZAR',
    });
    expect(result.matchedItem).toBeNull();
    expect(priceModel.findByCategoryAndItem).not.toHaveBeenCalled();
  });

  test('returns item-matched range when item matches a single row', async () => {
    const matchedRow = { item_type: 'Laptop', min_price: '2000', median_price: '3500', max_price: '5000' };
    priceModel.findByCategoryAndItem.mockResolvedValue([matchedRow]);
    const result = await priceService.suggestPrice('electronics', 'laptop');
    expect(result).toMatchObject({
      category: 'electronics',
      matchedItem: 'Laptop',
      min: 2000,
      median: 3500,
      max: 5000,
    });
  });

  test('aggregates multiple matched rows and picks highest scoring', async () => {
    const rows = [
      { item_type: 'Laptop Charger', min_price: '100', median_price: '200', max_price: '300' },
      { item_type: 'Laptop Bag',     min_price: '200', median_price: '400', max_price: '600' },
      { item_type: 'Laptop',         min_price: '3000', median_price: '4500', max_price: '6000' },
    ];
    priceModel.findByCategoryAndItem.mockResolvedValue(rows);
    const result = await priceService.suggestPrice('electronics', 'laptop');
    // 'laptop' matches all three: 'Laptop Charger' (1 term), 'Laptop Bag' (1 term), 'Laptop' (1 term exact)
    // All score 1, so top score is 1 and all three match → matchedItem is null (multiple top matches)
    expect(result).not.toBeNull();
    expect(result.currency).toBe('ZAR');
    expect(result.source).toContain('Takealot');
  });

  test('falls back to category range when no item rows match', async () => {
    priceModel.findByCategoryAndItem.mockResolvedValue([]);
    priceModel.getCategoryRange.mockResolvedValue({
      min_price: '50', median_price: '150', max_price: '300',
    });
    const result = await priceService.suggestPrice('textbooks', 'quantum physics');
    expect(result).toMatchObject({ category: 'textbooks', min: 50, median: 150, max: 300 });
    expect(result.matchedItem).toBeNull();
  });

  test('rounds min, median, max values', async () => {
    priceModel.getCategoryRange.mockResolvedValue({
      min_price: '99.5', median_price: '249.7', max_price: '499.3',
    });
    const result = await priceService.suggestPrice('clothing');
    expect(result.min).toBe(100);
    expect(result.median).toBe(250);
    expect(result.max).toBe(499);
  });

  test('includes source attribution in result', async () => {
    priceModel.getCategoryRange.mockResolvedValue({
      min_price: '100', median_price: '200', max_price: '300',
    });
    const result = await priceService.suggestPrice('electronics');
    expect(result.source).toContain('Takealot');
  });
});

// ─── listCategories ───────────────────────────────────────────────────────────

describe('priceService.listCategories', () => {
  test('delegates to priceModel.listCategories', async () => {
    priceModel.listCategories.mockResolvedValue(['electronics', 'textbooks', 'clothing']);
    const result = await priceService.listCategories();
    expect(priceModel.listCategories).toHaveBeenCalledTimes(1);
    expect(result).toEqual(['electronics', 'textbooks', 'clothing']);
  });

  test('returns empty array when no categories exist', async () => {
    priceModel.listCategories.mockResolvedValue([]);
    expect(await priceService.listCategories()).toEqual([]);
  });
});
