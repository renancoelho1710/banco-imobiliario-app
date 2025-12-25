import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Low, JSONFile } from "lowdb";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const file = path.join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data = db.data || { users: [], payments: [], properties: [], transactions: [], notifications: [] };
  await db.write();
}
initDB();

// API mínima
app.get("/api/users", async (req, res) => {
  await db.read();
  res.json(db.data.users);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const salas = {};

io.on("connection", (socket) => {
  socket.on("entrarSala", ({ sala, nome }) => {
    socket.join(sala);
    if (!salas[sala]) salas[sala] = { jogadores: {}, extrato: [] };
    salas[sala].jogadores[socket.id] = { nome, saldo: 15000, faliu: false };
    io.to(sala).emit("estadoSala", salas[sala]);
  });

  socket.on("pagar", ({ sala, de, para, valor, tipo }) => {
    const s = salas[sala]; if (!s) return;
    const pagador = s.jogadores[de]; const recebedor = s.jogadores[para]; if (!pagador || !recebedor) return;
    if (pagador.saldo < valor) { io.to(de).emit("erro", "Saldo insuficiente"); return; }
    pagador.saldo -= valor; recebedor.saldo += valor;
    s.extrato.push({ de: pagador.nome, para: recebedor.nome, valor, tipo, data: new Date().toISOString() });
    if (pagador.saldo <= 0) { pagador.faliu = true; io.to(de).emit("faliu"); }
    io.to(sala).emit("estadoSala", s);
    io.to(para).emit("recebido", { valor, tipo, de: pagador.nome });
  });

  socket.on("disconnect", () => {
    for (const s in salas) {
      if (salas[s].jogadores[socket.id]) { delete salas[s].jogadores[socket.id]; io.to(s).emit("estadoSala", salas[s]); }
    }
  });
});

server.listen(4000, () => console.log("Backend rodando na porta 4000"));
