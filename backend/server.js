import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const salas = {};

io.on("connection", (socket) => {
  socket.on("entrarSala", ({ sala, nome }) => {
    socket.join(sala);
    if (!salas[sala]) salas[sala] = { jogadores: {}, extrato: [] };
    salas[sala].jogadores[socket.id] = { nome, saldo: 15000, faliu: false };
    io.to(sala).emit("estadoSala", salas[sala]);
  });

  socket.on("pagar", ({ sala, de, para, valor, tipo }) => {
    const salaAtual = salas[sala];
    if (!salaAtual) return;

    const pagador = salaAtual.jogadores[de];
    const recebedor = salaAtual.jogadores[para];
    if (!pagador || !recebedor) return;

    if (pagador.saldo < valor) { io.to(de).emit("erro", "Saldo insuficiente"); return; }

    pagador.saldo -= valor;
    recebedor.saldo += valor;

    salaAtual.extrato.push({ de: pagador.nome, para: recebedor.nome, valor, tipo, data: new Date().toISOString() });

    if (pagador.saldo <= 0) { pagador.faliu = true; io.to(de).emit("faliu"); }

    io.to(sala).emit("estadoSala", salaAtual);
    io.to(para).emit("recebido", { valor, tipo, de: pagador.nome });
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
server.listen(PORT, () => console.log("Backend rodando na porta", PORT));
