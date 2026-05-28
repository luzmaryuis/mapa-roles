const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const FACILITATOR_KEY = process.env.FACILITATOR_KEY || "profe2024";
const PORT = process.env.PORT || 3000;

let state = {
  participants: [],
  session: { active: false, startedAt: null },
};

function broadcast() {
  io.emit("state", state);
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/facilitador", (req, res) => {
  if (req.query.key !== FACILITATOR_KEY) {
    return res.status(403).send(`
      <html><body style="font-family:monospace;background:#080C0B;color:#FF6B9D;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        Clave incorrecta.
      </body></html>
    `);
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  socket.emit("state", state);

  socket.on("join", ({ name }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = state.participants.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      socket.emit("join_error", "Ese nombre ya está en uso");
      return;
    }
    state.participants.push({
      id: socket.id,
      name: trimmed,
      role: null,
      joinedAt: Date.now(),
    });
    socket.emit("join_ok", { name: trimmed });
    broadcast();
  });

  socket.on("select_role", ({ name, role }) => {
    const p = state.participants.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (p) { p.role = role; broadcast(); }
  });

  socket.on("start_session", ({ key }) => {
    if (key !== FACILITATOR_KEY) return;
    state.session = { active: true, startedAt: Date.now() };
    broadcast();
  });

  socket.on("reset_session", ({ key }) => {
    if (key !== FACILITATOR_KEY) return;
    state = { participants: [], session: { active: false, startedAt: null } };
    broadcast();
  });

  socket.on("disconnect", () => {
    state.participants = state.participants.filter((p) => p.id !== socket.id);
    broadcast();
  });
});

server.listen(PORT, () => {
  console.log(`Corriendo en puerto ${PORT}`);
});
