const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data = db.data || { users: [], payments: [], properties: [], transactions: [], notifications: [] };
  await db.write();
}
initDB();

function now() { return new Date().toISOString(); }

app.use(async (req, res, next) => {
  await db.read();
  if (req.body && req.body._userId) {
    const u = db.data.users.find(x => x.id === req.body._userId);
    if (u) { u.lastActive = Date.now(); await db.write(); }
  }
  next();
});

// Rotas aqui (register, login, payments, properties, etc)
// Copia todas as rotas que você já tinha do index.js anterior

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
