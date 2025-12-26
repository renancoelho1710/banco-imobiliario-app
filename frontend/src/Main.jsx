const socket = io("https://banco-imobiliario-app.onrender.com");

function App() {
  const [nome, setNome] = React.useState("");
  const [sala, setSala] = React.useState("");
  const [estadoSala, setEstadoSala] = React.useState(null);

  const entrarSala = () => {
    if (!nome || !sala) return alert("Preencha nome e sala");
    socket.emit("entrarSala", { nome, sala });
  };

  React.useEffect(() => {
    socket.on("estadoSala", (data) => setEstadoSala(data));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Banco Imobiliário</h1>

      {!estadoSala ? (
        <div>
          <input placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} />
          <input placeholder="Sala" value={sala} onChange={e => setSala(e.target.value)} />
          <button onClick={entrarSala}>Entrar</button>
        </div>
      ) : (
        <div>
          <h2>Jogadores na sala:</h2>
          <ul>
            {Object.values(estadoSala.jogadores).map(j => (
              <li key={j.nome}>{j.nome} - ${j.saldo}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
