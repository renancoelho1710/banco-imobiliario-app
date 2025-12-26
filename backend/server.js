import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'  // versão correta pro Node ESM
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, 'db.json');  // arquivo do DB
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Dados iniciais
await db.read();
db.data ||= { salas: {} };  // se estiver vazio, cria estrutura inicial
await db.write();

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("entrarSala", ({ sala, nome }) => {
    socket.join(sala);

    if (!db.data.salas[sala]) {
      db.data.salas[sala] = { jogadores: {}, extrato: [] };
    }

    db.data.salas[sala].jogadores[socket.id] = {
      nome,
      saldo: 15000,
      faliu: false
    };

    io.to(sala).emit("estadoSala", db.data.salas[sala]);
  });

  socket.on("pagar", ({ sala, de, para, valor, tipo }) => {
    const salaAtual = db.data.salas[sala];
    if (!salaAtual) return;

    const pagador = salaAtual.jogadores[de];
    const recebedor = salaAtual.jogadores[para];
    if (!pagador || !recebedor) return;

    if (pagador.saldo < valor) {
      io.to(de).emit("erro", "Saldo insuficiente");
      return;
    }

    pagador.saldo -= valor;
    recebedor.saldo += valor;

    salaAtual.extrato.push({ de: pagador.nome, para: recebedor.nome, valor, tipo, data: new Date().toISOString() });

    if (pagador.saldo <= 0) io.to(de).emit("faliu");

    io.to(sala).emit("estadoSala", salaAtual);
    io.to(para).emit("recebido", { valor, tipo, de: pagador.nome });
  });

  socket.on("disconnect", () => {
    for (const sala in db.data.salas) {
      if (db.data.salas[sala].jogadores[socket.id]) {
        delete db.data.salas[sala].jogadores[socket.id];
        io.to(sala).emit("estadoSala", db.data.salas[sala]);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Backend rodando na porta", PORT));
