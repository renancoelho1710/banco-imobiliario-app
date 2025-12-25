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

// Banco de dados simples com LowDB
const file = path.join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data = db.data || { users: [], transactions: [] };
  await db.write();
}
initDB();

// Salas de jogo em memória
const salas = {};

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Entrar na sala
io.on("connection", (socket) => {
  socket.on("entrarSala", ({ sala, nome }) => {
    socket.join(sala);
    if (!salas[sala]) salas[sala] = { jogadores: {}, extrato: [] };

    salas[sala].jogadores[socket.id] = { nome, saldo: 15000, faliu: false, online: true };
    io.to(sala).emit("estadoSala", salas[sala]);
  });

  // Pagar outro jogador
  socket.on("pagar", ({ sala, de, para, valor, tipo }) => {
    const salaAtual = salas[sala];
    if (!salaAtual) return;
    const pagador = salaAtual.jogadores[de];
    const recebedor = salaAtual.jogadores[para];
    if (!pagador || !recebedor) return;
    if (pagador.saldo < valor) return; // saldo insuficiente

    pagador.saldo -= valor;
    recebedor.saldo += valor;

    salaAtual.extrato.push({ de: pagador.nome, para: recebedor.nome, valor, tipo, data: new Date().toISOString() });
    io.to(sala).emit("estadoSala", salaAtual);
    io.to(para).emit("recebido", { de: pagador.nome, valor, tipo });
  });

  socket.on("disconnect", () => {
    for (const sala in salas) {
      if (salas[sala].jogadores[socket.id]) {
        delete salas[sala].jogadores[socket.id];
        io.to(sala).emit("estadoSala", salas[sala]);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
