'use strict';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const pool = require('../src/config/db');
const listingModel = require('../src/models/listing');
const listingService = require('../src/services/listingService');
const listingController = require('../src/controllers/listingController');

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'seller-1', role: 'student' },
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

// ─── listingModel ─────────────────────────────────────────────────────────────

describe('listingModel.findAll', () => {
  test('no filters returns active listings', async () => {
    const row = { id: 'l1', title: 'Textbook' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await listingModel.findAll();
    const [, values] = pool.query.mock.calls[0];
    expect(values[0]).toBe('active');
    expect(result).toEqual([row]);
  });

  test('passes category filter', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await listingModel.findAll({ category: 'electronics' });
    const [, values] = pool.query.mock.calls[0];
    expect(values).toContain('electronics');
  });

  test('passes type and condition filters', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await listingModel.findAll({ type: 'trade', condition: 'good' });
    const [, values] = pool.query.mock.calls[0];
    expect(values).toContain('trade');
    expect(values).toContain('good');
  });

  test('custom status filter', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await listingModel.findAll({ status: 'sold' });
    const [, values] = pool.query.mock.calls[0];
    expect(values[0]).toBe('sold');
  });
});

describe('listingModel.findById', () => {
  test('returns listing when found', async () => {
    const row = { id: 'l1', title: 'Laptop' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await listingModel.findById('l1');
    expect(result).toEqual(row);
  });

  test('returns null when not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await listingModel.findById('nonexistent');
    expect(result).toBeNull();
  });
});

describe('listingModel.findBySeller', () => {
  test('returns rows for the seller', async () => {
    const rows = [{ id: 'l1' }, { id: 'l2' }];
    pool.query.mockResolvedValue({ rows });
    const result = await listingModel.findBySeller('seller-1');
    expect(result).toEqual(rows);
    const [, values] = pool.query.mock.calls[0];
    expect(values[0]).toBe('seller-1');
  });
});

describe('listingModel.create', () => {
  test('inserts and returns new listing', async () => {
    const row = { id: 'l1', title: 'Notes', seller_id: 'seller-1' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await listingModel.create({
      sellerId: 'seller-1', title: 'Notes', description: 'Good notes',
      price: 50, condition: 'good', type: 'sale', category: 'textbooks',
    });
    expect(result).toEqual(row);
  });
});

describe('listingModel.updateStatus', () => {
  test('returns updated listing', async () => {
    const row = { id: 'l1', status: 'sold' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await listingModel.updateStatus('l1', 'sold');
    expect(result).toEqual(row);
  });

  test('returns null when listing not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await listingModel.updateStatus('nonexistent', 'sold');
    expect(result).toBeNull();
  });
});

describe('listingModel.update', () => {
  test('updates provided fields and returns listing', async () => {
    const row = { id: 'l1', title: 'Updated', price: 100 };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await listingModel.update('l1', { title: 'Updated', price: 100 });
    expect(result).toEqual(row);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('title');
    expect(sql).toContain('price');
  });

  test('calls findById when no fields are provided', async () => {
    const row = { id: 'l1', title: 'Unchanged' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await listingModel.update('l1', {});
    expect(result).toEqual(row);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('WHERE l.id');
  });

  test('returns null when listing not found during partial update', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const result = await listingModel.update('bad-id', { title: 'X' });
    expect(result).toBeNull();
  });
});

describe('listingModel.delete', () => {
  test('returns true when row deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 1 });
    expect(await listingModel.delete('l1')).toBe(true);
  });

  test('returns false when nothing deleted', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    expect(await listingModel.delete('nonexistent')).toBe(false);
  });
});

describe('listingModel.addImage', () => {
  test('inserts and returns image record', async () => {
    const row = { id: 'img-1', listing_id: 'l1', image_url: 'http://cdn/a.jpg' };
    pool.query.mockResolvedValue({ rows: [row] });
    const result = await listingModel.addImage('l1', 'http://cdn/a.jpg');
    expect(result).toEqual(row);
  });
});

// ─── listingService ───────────────────────────────────────────────────────────

describe('listingService.getListings', () => {
  afterEach(() => jest.restoreAllMocks());

  test('passes filters to model and returns results', async () => {
    const rows = [{ id: 'l1' }];
    jest.spyOn(listingModel, 'findAll').mockResolvedValue(rows);
    const result = await listingService.getListings({ category: 'electronics', type: 'sale' });
    expect(listingModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'electronics', type: 'sale' })
    );
    expect(result).toEqual(rows);
  });
});

describe('listingService.getListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('returns listing when found', async () => {
    const listing = { id: 'l1', title: 'Laptop' };
    jest.spyOn(listingModel, 'findById').mockResolvedValue(listing);
    expect(await listingService.getListing('l1')).toEqual(listing);
  });

  test('throws 404 when not found', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue(null);
    await expect(listingService.getListing('bad')).rejects.toMatchObject({ status: 404 });
  });
});

describe('listingService.createListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('creates listing with valid data', async () => {
    const row = { id: 'l1', title: 'Textbook' };
    jest.spyOn(listingModel, 'create').mockResolvedValue(row);
    const result = await listingService.createListing('seller-1', {
      title: 'Textbook', description: 'Good condition', price: 150,
      condition: 'good', type: 'sale', category: 'textbooks',
    });
    expect(result).toEqual(row);
  });

  test('throws 400 for whitespace-only title', async () => {
    await expect(
      listingService.createListing('s', { title: '   ', type: 'sale', condition: 'good' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 when title is absent', async () => {
    await expect(
      listingService.createListing('s', { type: 'sale', condition: 'good' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 for invalid type', async () => {
    await expect(
      listingService.createListing('s', { title: 'X', type: 'barter', condition: 'good' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 for invalid condition', async () => {
    await expect(
      listingService.createListing('s', { title: 'X', type: 'sale', condition: 'terrible' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test.each(['sale', 'trade', 'both'])('accepts valid type "%s"', async (type) => {
    jest.spyOn(listingModel, 'create').mockResolvedValue({ id: 'l1' });
    await expect(
      listingService.createListing('s', { title: 'X', type, condition: 'good' })
    ).resolves.toBeDefined();
  });

  test.each(['new', 'good', 'fair'])('accepts valid condition "%s"', async (condition) => {
    jest.spyOn(listingModel, 'create').mockResolvedValue({ id: 'l1' });
    await expect(
      listingService.createListing('s', { title: 'X', type: 'sale', condition })
    ).resolves.toBeDefined();
  });
});

describe('listingService.updateListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('updates listing when requester is owner', async () => {
    const listing = { id: 'l1', seller_id: 'seller-1' };
    const updated = { id: 'l1', title: 'Updated' };
    jest.spyOn(listingModel, 'findById').mockResolvedValue(listing);
    jest.spyOn(listingModel, 'update').mockResolvedValue(updated);
    expect(await listingService.updateListing('l1', 'seller-1', { title: 'Updated' })).toEqual(updated);
  });

  test('throws 404 when listing not found', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue(null);
    await expect(listingService.updateListing('bad', 'seller-1', {})).rejects.toMatchObject({ status: 404 });
  });

  test('throws 403 when requester is not the owner', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'other' });
    await expect(listingService.updateListing('l1', 'seller-1', {})).rejects.toMatchObject({ status: 403 });
  });

  test('throws 400 for invalid status in update payload', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'seller-1' });
    await expect(
      listingService.updateListing('l1', 'seller-1', { status: 'deleted' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 for invalid type in update payload', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'seller-1' });
    await expect(
      listingService.updateListing('l1', 'seller-1', { type: 'barter' })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('listingService.deleteListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('deletes when requester is the owner', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'seller-1' });
    jest.spyOn(listingModel, 'delete').mockResolvedValue(true);
    await expect(listingService.deleteListing('l1', 'seller-1', 'student')).resolves.toBeUndefined();
    expect(listingModel.delete).toHaveBeenCalledWith('l1');
  });

  test('deletes when requester is admin even if not owner', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'other' });
    jest.spyOn(listingModel, 'delete').mockResolvedValue(true);
    await expect(listingService.deleteListing('l1', 'admin-id', 'admin')).resolves.toBeUndefined();
  });

  test('throws 404 when listing not found', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue(null);
    await expect(listingService.deleteListing('bad', 'seller-1', 'student')).rejects.toMatchObject({ status: 404 });
  });

  test('throws 403 when not owner and not admin', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'other' });
    await expect(listingService.deleteListing('l1', 'seller-1', 'student')).rejects.toMatchObject({ status: 403 });
  });
});

// ─── listingController ────────────────────────────────────────────────────────

describe('listingController.getListings', () => {
  afterEach(() => jest.restoreAllMocks());

  test('200 with listings array', async () => {
    jest.spyOn(listingService, 'getListings').mockResolvedValue([{ id: 'l1' }]);
    const req = makeReq({ query: { category: 'electronics' } });
    const res = makeRes();
    await listingController.getListings(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 'l1' }]);
  });

  test('500 on service error', async () => {
    jest.spyOn(listingService, 'getListings').mockRejectedValue(new Error('DB down'));
    const req = makeReq();
    const res = makeRes();
    await listingController.getListings(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'DB down' });
  });
});

describe('listingController.getListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('200 with listing', async () => {
    const listing = { id: 'l1', title: 'Laptop' };
    jest.spyOn(listingService, 'getListing').mockResolvedValue(listing);
    const req = makeReq({ params: { id: 'l1' } });
    const res = makeRes();
    await listingController.getListing(req, res);
    expect(res.json).toHaveBeenCalledWith(listing);
  });

  test('404 when not found', async () => {
    jest.spyOn(listingService, 'getListing').mockRejectedValue(
      Object.assign(new Error('Listing not found'), { status: 404 })
    );
    const req = makeReq({ params: { id: 'bad' } });
    const res = makeRes();
    await listingController.getListing(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('listingController.createListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('201 with created listing', async () => {
    jest.spyOn(listingService, 'createListing').mockResolvedValue({ id: 'l1' });
    const req = makeReq({ body: { title: 'Book', type: 'sale', condition: 'good' } });
    const res = makeRes();
    await listingController.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'l1' });
  });

  test('400 on validation error', async () => {
    jest.spyOn(listingService, 'createListing').mockRejectedValue(
      Object.assign(new Error('title is required'), { status: 400 })
    );
    const req = makeReq({ body: {} });
    const res = makeRes();
    await listingController.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'title is required' });
  });
});

describe('listingController.updateListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('200 with updated listing', async () => {
    const updated = { id: 'l1', title: 'Updated' };
    jest.spyOn(listingService, 'updateListing').mockResolvedValue(updated);
    const req = makeReq({ params: { id: 'l1' }, body: { title: 'Updated' } });
    const res = makeRes();
    await listingController.updateListing(req, res);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('403 on forbidden error', async () => {
    jest.spyOn(listingService, 'updateListing').mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 })
    );
    const req = makeReq({ params: { id: 'l1' } });
    const res = makeRes();
    await listingController.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('500 on unexpected error', async () => {
    jest.spyOn(listingService, 'updateListing').mockRejectedValue(new Error('crash'));
    const req = makeReq({ params: { id: 'l1' } });
    const res = makeRes();
    await listingController.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('listingController.deleteListing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('204 on success', async () => {
    jest.spyOn(listingService, 'deleteListing').mockResolvedValue();
    const req = makeReq({ params: { id: 'l1' } });
    const res = makeRes();
    await listingController.deleteListing(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  test('403 on forbidden', async () => {
    jest.spyOn(listingService, 'deleteListing').mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 })
    );
    const req = makeReq({ params: { id: 'l1' } });
    const res = makeRes();
    await listingController.deleteListing(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('listingController.addListingImage', () => {
  afterEach(() => jest.restoreAllMocks());

  test('400 when imageUrl is missing', async () => {
    const req = makeReq({ params: { id: 'l1' }, body: {} });
    const res = makeRes();
    await listingController.addListingImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'imageUrl is required' });
  });

  test('404 when listing not found', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue(null);
    const req = makeReq({ params: { id: 'l1' }, body: { imageUrl: 'http://cdn/a.jpg' } });
    const res = makeRes();
    await listingController.addListingImage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Listing not found' });
  });

  test('403 when requester is not the seller', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'other' });
    const req = makeReq({ params: { id: 'l1' }, body: { imageUrl: 'http://cdn/a.jpg' } });
    const res = makeRes();
    await listingController.addListingImage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  test('201 with created image record', async () => {
    const image = { id: 'img-1', listing_id: 'l1', image_url: 'http://cdn/a.jpg' };
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'seller-1' });
    jest.spyOn(listingModel, 'addImage').mockResolvedValue(image);
    const req = makeReq({ params: { id: 'l1' }, body: { imageUrl: 'http://cdn/a.jpg' } });
    const res = makeRes();
    await listingController.addListingImage(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(image);
  });

  test('500 when addImage throws', async () => {
    jest.spyOn(listingModel, 'findById').mockResolvedValue({ id: 'l1', seller_id: 'seller-1' });
    jest.spyOn(listingModel, 'addImage').mockRejectedValue(new Error('DB error'));
    const req = makeReq({ params: { id: 'l1' }, body: { imageUrl: 'http://cdn/a.jpg' } });
    const res = makeRes();
    await listingController.addListingImage(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
