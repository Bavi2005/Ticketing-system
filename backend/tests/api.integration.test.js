// backend/tests/api.integration.test.js
// Integration tests hitting the real Express app against a real Postgres test DB.
// Requires: DATABASE_URL pointing at a throw-away database (see npm script).

const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';

const app = require('../src/server');
const prisma = require('../src/utils/prisma');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const uniq = (p) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function registerUser(email = uniq('user') + '@example.com', password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Test User',
    email,
    password,
  });
  return res;
}

async function loginUser(email, password = 'password123') {
  return request(app).post('/api/auth/login').send({ email, password });
}

async function makeAdmin() {
  const email = uniq('admin') + '@example.com';
  await request(app).post('/api/auth/register').send({ name: 'Admin', email, password: 'adminpass1' });
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  const res = await request(app).post('/api/admin/login').send({ email, password: 'adminpass1' });
  return res.body.token;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  // Clean DB between tests — order matters due to FKs
  await prisma.voucher.deleteMany({});
  await prisma.receipt.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /ready checks DB', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });
});

describe('Auth', () => {
  it('registers a new user', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toContain('@');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate registration with 409', async () => {
    const email = uniq('dup') + '@example.com';
    await registerUser(email);
    const res = await registerUser(email);
    expect(res.status).toBe(409);
  });

  it('rejects invalid credentials with 401', async () => {
    const email = uniq('wrong') + '@example.com';
    await registerUser(email);
    const res = await loginUser(email, 'wrongpass1');
    expect(res.status).toBe(401);
  });

  it('rejects unknown account with 401', async () => {
    const res = await loginUser('nobody@example.com');
    expect(res.status).toBe(401);
  });

  it('rejects invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/user/dashboard')
      .set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });
});

describe('Receipt upload & business rules', () => {
  it('creates a receipt as PENDING', async () => {
    const reg = await registerUser();
    const res = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '49.90')
      .attach('receipt', PNG, 'receipt.png');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
  });

  it('rejects invalid file type with 400', async () => {
    const reg = await registerUser();
    const res = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '10')
      .attach('receipt', Buffer.from('MZ not an image'), 'evil.exe');
    expect(res.status).toBe(400);
  });

  it('rejects invalid amount', async () => {
    const reg = await registerUser();
    const res = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '-5')
      .attach('receipt', PNG, 'r.png');
    expect(res.status).toBe(400);
  });

  it('rejects duplicate order id for same user with 409', async () => {
    const reg = await registerUser();
    const oid = uniq('ORD');
    await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .field('orderId', oid)
      .field('purchaseDate', '2026-08-30')
      .field('amount', '10')
      .attach('receipt', PNG, 'r.png');
    const res = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .field('orderId', oid)
      .field('purchaseDate', '2026-08-30')
      .field('amount', '10')
      .attach('receipt', PNG, 'r.png');
    expect(res.status).toBe(409);
  });

  it('users only see their own receipts', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${a.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '10')
      .attach('receipt', PNG, 'r.png');
    const mine = await request(app)
      .get('/api/user/receipts')
      .set('Authorization', `Bearer ${b.body.token}`);
    expect(mine.body.length).toBe(0);
  });

  it('supports phone-only registration and login', async () => {
    const phone =
      `+6012${Math.floor(
        1000000 +
        Math.random() * 9000000
      )}`;

    const registration =
      await request(app)
        .post(
          '/api/auth/register'
        )
        .send({
          name:
            'Phone User',

          phone,

          password:
            'password123',
        });

    expect(
      registration.status
    ).toBe(201);

    expect(
      registration.body.user
        .email
    ).toBeNull();

    expect(
      registration.body.user
        .phone
    ).toBe(phone);

    const login =
      await request(app)
        .post(
          '/api/auth/login'
        )
        .send({
          email:
            phone,

          password:
            'password123',
        });

    expect(
      login.status
    ).toBe(200);

    expect(
      login.body.token
    ).toBeTruthy();
  });
});


describe('Approval → exactly one voucher (idempotency + concurrency)', () => {
  it('creates exactly one voucher, even when approved twice concurrently', async () => {
    const userRes = await registerUser();
    const adminToken = await makeAdmin();

    const up = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${userRes.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '25')
      .attach('receipt', PNG, 'r.png');
    const receiptId = up.body.id;

    // Hammer approve 3x concurrently
    const [r1, r2, r3] = await Promise.all([
      request(app).post(`/api/admin/receipts/${receiptId}/approve`).set('Authorization', `Bearer ${adminToken}`),
      request(app).post(`/api/admin/receipts/${receiptId}/approve`).set('Authorization', `Bearer ${adminToken}`),
      request(app).post(`/api/admin/receipts/${receiptId}/approve`).set('Authorization', `Bearer ${adminToken}`),
    ]);

    // All should succeed with 200 (never a 500 / duplicate error)
    for (const r of [r1, r2, r3]) {
      expect([200]).toContain(r.status);
    }

    const vouchers = await request(app)
      .get('/api/user/vouchers')
      .set('Authorization', `Bearer ${userRes.body.token}`);
    expect(vouchers.body.length).toBe(1);
    expect(vouchers.body[0].receiptId).toBe(receiptId);
  });

  it('rejected receipt creates no voucher', async () => {
    const userRes = await registerUser();
    const adminToken = await makeAdmin();
    const up = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${userRes.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '25')
      .attach('receipt', PNG, 'r.png');
    await request(app)
      .post(`/api/admin/receipts/${up.body.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    const vouchers = await request(app)
      .get('/api/user/vouchers')
      .set('Authorization', `Bearer ${userRes.body.token}`);
    expect(vouchers.body.length).toBe(0);
  });
});

describe('Authorization boundaries', () => {
  it('user cannot reach admin dashboard (403)', async () => {
    const reg = await registerUser();
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(403);
  });

  it('user cannot approve a receipt (403)', async () => {
    const reg = await registerUser();
    const up = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '10')
      .attach('receipt', PNG, 'r.png');
    const res = await request(app)
      .post(`/api/admin/receipts/${up.body.id}/approve`)
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(403);
  });
});

describe('Voucher redemption', () => {
  it('redeems once; second redeem fails', async () => {
    const userRes = await registerUser();
    const adminToken = await makeAdmin();
    const up = await request(app)
      .post('/api/user/receipts')
      .set('Authorization', `Bearer ${userRes.body.token}`)
      .field('orderId', uniq('ORD'))
      .field('purchaseDate', '2026-08-30')
      .field('amount', '10')
      .attach('receipt', PNG, 'r.png');
    await request(app)
      .post(`/api/admin/receipts/${up.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    const vouchers = await request(app)
      .get('/api/user/vouchers')
      .set('Authorization', `Bearer ${userRes.body.token}`);
    const vid = vouchers.body[0].id;

    const first = await request(app)
      .post(`/api/user/vouchers/${vid}/redeem`)
      .set('Authorization', `Bearer ${userRes.body.token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/user/vouchers/${vid}/redeem`)
      .set('Authorization', `Bearer ${userRes.body.token}`);
    expect(second.status).toBe(400);
  });
});
