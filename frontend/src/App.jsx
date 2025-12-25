import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import QRCode from "qrcode.react";
import QrScanner from "qr-scanner";

const socket = io("http://SEU_BACKEND:3001"); // troca pelo seu backend

export default function App() {
  const [nome, setNome] = useState("");
  const [sala, setSala] = useState("sala1");
  const [logado, setLogado] = useState(false);
  const [estado, setEstado] = useState(null);
  const [tela, setTela] = useState("home");
  const [valor, setValor] = useState("");
  const [qrData, setQrData] = useState(null);

  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    socket.on("estadoSala", setEstado);
    socket.on("recebido", (d) => alert(`Recebeu R$ ${d.valor} de ${d.de}`));
    socket.on("erro", (e) => alert(e));
    socket.on("faliu", () => alert("Você faliu"));

    return () => socket.off();
  }, []);

  useEffect(() => {
    if (tela === "pagar" && videoRef.current) {
      scannerRef.current = new QrScanner(
        videoRef.current,
        (res) => {
          const dados = JSON.parse(res.data);
          socket.emit("pagar", dados);
          scannerRef.current.stop();
          setTela("home");
        }
      );
      scannerRef.current.start();
    }

    return () => scannerRef.current?.stop();
  }, [tela]);

  if (!logado) {
    return (
      <div className="login">
        <h2>Banco do Jogo</h2>
        <input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="Sala" value={sala} onChange={(e) => setSala(e.target.value)} />
        <button onClick={() => { socket.emit("entrarSala", { sala, nome }); setLogado(true); }}>
          Entrar
        </button>
      </div>
    );
  }

  if (!estado) return <p>Carregando...</p>;

  const jogadores = estado.jogadores;
  const meuId = socket.id;
  const eu = jogadores[meuId];

  return (
    <div className="app">
      <h3>{eu.nome}</h3>
      <p>Saldo: R$ {eu.saldo}</p>

      {tela === "home" && (
        <>
          <button onClick={() => setTela("cobrar")}>Cobrar</button>
          <button onClick={() => setTela("pagar")}>Pagar</button>
          <button onClick={() => setTela("extrato")}>Extrato</button>

          <h4>Jogadores</h4>
          {Object.entries(jogadores).map(([id, j]) => (
            <div key={id}>{j.nome} — R$ {j.saldo}</div>
          ))}
        </>
      )}

      {tela === "cobrar" && (
        <>
          <h4>Cobrar jogador</h4>
          <input placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
          {Object.entries(jogadores).filter(([id]) => id !== meuId).map(([id, j]) => (
            <button key={id} onClick={() => setQrData(JSON.stringify({ sala, de: id, para: meuId, valor: Number(valor), tipo: "aluguel" }))}>
              {j.nome}
            </button>
          ))}
          {qrData && <QRCode value={qrData} size={220} />}
          <button onClick={() => setTela("home")}>Voltar</button>
        </>
      )}

      {tela === "pagar" && (
        <>
          <h4>Escanear QR</h4>
          <video ref={videoRef} style={{ width: "100%" }} />
          <button onClick={() => setTela("home")}>Cancelar</button>
        </>
      )}

      {tela === "extrato" && (
        <>
          <h4>Extrato</h4>
          {estado.extrato.map((e, i) => (
            <div key={i}>{e.de} → {e.para} | R$ {e.valor}</div>
          ))}
          <button onClick={() => setTela("home")}>Voltar</button>
        </>
      )}
    </div>
  );
}
