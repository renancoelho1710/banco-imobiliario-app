import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Low, JSONFile } from "lowdb";
import { nanoid } from "nanoid";
import path from "path";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const file = path.join("./db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data = db.data || { users: [], payments: [], properties: [], transactions: [], notifications: [] };
  await db.write();
}
initDB();

function now() { return new Date().toISOString(); }

// Middleware: atualizar lastActive
app.use(async (req, res, next) => {
  await db.read();
  if (req.body && req.body._userId) {
    const u = db.data.users.find(x => x.id === req.body._userId);
    if (u) { u.lastActive = Date.now(); await db.write(); }
  }
  next();
});

// Criar usuário
app.post('/api/register', async (req, res) => {
  const { name, password, role, startingAmount } = req.body;
  await db.read();
  const exists = db.data.users.find(u => u.name === name && u.role === role && !u.finalized);
  if (exists) return res.status(400).json({ error: 'Nome já em uso nessa partida para esse papel' });
  const user = {
    id: nanoid(),
    name,
    password,
    role,
    balance: Number(startingAmount || 0),
    jailTax: 50,
    lastActive: Date.now(),
    finalized: false,
    bankrupt: false
  };
  db.data.users.push(user);
  await db.write();
  res.json({ user });
});

// Login
app.post('/api/login', async (req, res) => {
  const { name, password, role } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.name === name && u.password === password && u.role === role && !u.finalized);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas ou partida finalizada' });
  res.json({ user });
});

// Listar usuários
app.get('/api/users', async (req, res) => {
  await db.read();
  res.json(db.data.users.filter(u => !u.finalized));
});

// Properties
app.get('/api/properties', async (req, res) => {
  await db.read();
  res.json(db.data.properties || []);
});
app.post('/api/properties', async (req, res) => {
  const { name, type, houses, rent, ownerId } = req.body;
  await db.read();
  const prop = { id: nanoid(), name, type, houses: Number(houses), rent: Number(rent), ownerId: ownerId || null };
  db.data.properties.push(prop);
  await db.write();
  res.json(prop);
});

// Pagamentos
app.post('/api/payments/request', async (req, res) => {
  const { toUserId, amount, reason, fromUserId } = req.body;
  await db.read();
  const payment = {
    id: nanoid(),
    toUserId,
    fromUserId: fromUserId || null,
    amount: Number(amount),
    reason: reason || 'payment',
    createdAt: Date.now(),
    claimed: false
  };
  db.data.payments.push(payment);
  db.data.transactions.push({ id: nanoid(), type: 'request', paymentId: payment.id, toUserId, amount: payment.amount, reason: payment.reason, createdAt: now() });
  await db.write();
  res.json({ paymentId: payment.id, qrPayload: JSON.stringify({ type: 'payment_request', paymentId: payment.id }) });
});

app.post('/api/payments/claim', async (req, res) => {
  const { paymentId, payerId } = req.body;
  await db.read();
  const payment = db.data.payments.find(p => p.id === paymentId);
  if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado' });
  if (payment.claimed) return res.status(400).json({ error: 'Pagamento já reclamado' });
  const payer = db.data.users.find(u => u.id === payerId && !u.finalized);
  const recipient = db.data.users.find(u => u.id === payment.toUserId && !u.finalized);
  if (!payer || !recipient) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (payer.balance < payment.amount) return res.status(400).json({ error: 'Saldo insuficiente' });

  payer.balance -= payment.amount;
  recipient.balance += payment.amount;
  payment.claimed = true;
  payment.payerId = payerId;
  payment.claimedAt = Date.now();

  db.data.transactions.push({ id: nanoid(), type: 'payment', paymentId: payment.id, from: payerId, to: recipient.id, amount: payment.amount, reason: payment.reason, createdAt: now() });
  await db.write();
  res.json({ ok: true, payment, payer, recipient });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
