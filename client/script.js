const socket = io("https://checkers-admin-3.onrender.com"); // ← now replaced with backed url
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const SIZE = 8;
const TILE = 75;
let board = [];
let currentPlayer = 1;
let selected = null;
let validMoves = [];
let gameMode = ""; // "offline", "online", "ai"
let roomId = "";
let playerIndex = 1;
let isMyTurn = true;
let timer = 30;
let timerInterval;

const playerNames = { 1: "Player 1", 2: "Player 2" };

function initBoard() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (let r =  0; r < 3; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 2;
    }
  }
  for (let r = SIZE - 3; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 1;
    }
  }
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#fff" : "#333";
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);

      if (selected && validMoves.some(([rr, cc]) => rr === r && cc === c)) {
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 4;
        ctx.strokeRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
      }

      const piece = board[r][c];
      if (piece !== 0) {
        ctx.beginPath();
        ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, 25, 0, 2 * Math.PI);
        ctx.fillStyle = piece === 1 ? "red" : "black";
        ctx.fill();
      }
    }
  }
}

function getValidMoves(r, c) {
  const directions = currentPlayer === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  const moves = [];

  directions.forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    const jumpR = r + 2 * dr, jumpC = c + 2 * dc;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === 0) {
      moves.push([nr, nc]);
    }
    if (
      jumpR >= 0 && jumpR < SIZE && jumpC >= 0 && jumpC < SIZE &&
      board[nr][nc] !== 0 && board[nr][nc] !== currentPlayer &&
      board[jumpR][jumpC] === 0
    ) {
      moves.push([jumpR, jumpC]);
    }
  });
  return moves;
}

function switchPlayer() {
  currentPlayer = 3 - currentPlayer;
  isMyTurn = gameMode !== "online" || currentPlayer === playerIndex;
  resetTimer();
  updateUI();
}

function checkWin() {
  const flat = board.flat();
  const red = flat.filter(p => p === 1).length;
  const black = flat.filter(p => p === 2).length;
  if (red === 0) showEnd("Black wins!");
  else if (black === 0) showEnd("Red wins!");
  else if (red === 1 && black === 1) showEnd("Draw!");
}

function showEnd(msg) {
  clearInterval(timerInterval);
  document.getElementById("endMessage").innerText = msg;
  document.getElementById("endMessage").classList.remove("hidden");
}

function resetTimer() {
  clearInterval(timerInterval);
  timer = 30;
  updateUI();
  timerInterval = setInterval(() => {
    timer--;
    updateUI();
    if (timer <= 0) {
      clearInterval(timerInterval);
      showEnd(`${currentPlayer === 1 ? "Red" : "Black"} ran out of time!`);
    }
  }, 1000);
}

function updateUI() {
  document.getElementById("turnIndicator").innerText = `${currentPlayer === 1 ? "Red" : "Black"}'s Turn`;
  document.getElementById("timer").innerText = `Time left: ${timer}s`;
}

canvas.addEventListener("click", (e) => {
  if (!isMyTurn) return;
  const x = Math.floor(e.offsetX / TILE);
  const y = Math.floor(e.offsetY / TILE);

  if (selected) {
    const [r, c] = selected;
    if (validMoves.some(([rr, cc]) => rr === y && cc === x)) {
      if (gameMode === "online") {
        socket.emit("move", { roomId, move: { from: [r, c], to: [y, x] } });
      }
      movePiece(r, c, y, x);
      drawBoard();
      checkWin();
      if (gameMode === "ai" && currentPlayer === 2) aiMove();
      return;
    }
  }

  if (board[y][x] === currentPlayer) {
    selected = [y, x];
    validMoves = getValidMoves(y, x);
  } else {
    selected = null;
    validMoves = [];
  }

  drawBoard();
});

function movePiece(r1, c1, r2, c2) {
  board[r2][c2] = board[r1][c1];
  board[r1][c1] = 0;
  if (Math.abs(r2 - r1) === 2) {
    const mr = (r1 + r2) / 2, mc = (c1 + c2) / 2;
    board[mr][mc] = 0;
  }
  selected = null;
  validMoves = [];
  drawBoard();
  switchPlayer();
}

function startOffline() {
  gameMode = "offline";
  setupGameUI("You", "Player 2");
}

function startVsAI() {
  gameMode = "ai";
  setupGameUI("You", "Computer");
}

function setupGameUI(p1Name, p2Name) {
  document.getElementById("mainMenu").classList.add("hidden");
  document.getElementById("waitingScreen").classList.add("hidden");
  document.getElementById("gameCanvas").classList.remove("hidden");
  document.getElementById("playerInfo").classList.remove("hidden");
  document.getElementById("endMessage").classList.add("hidden");

  playerNames[1] = p1Name;
  playerNames[2] = p2Name;
  document.getElementById("player1Name").innerText = playerNames[1];
  document.getElementById("player2Name").innerText = playerNames[2];

  initBoard();
  drawBoard();
  resetTimer();
}

function createRoom() {
  const name = document.getElementById("playerName").value || "Player 1";
  socket.emit("createRoom", { name });
}

function joinRoom() {
  const name = document.getElementById("playerName").value || "Player 2";
  const id = document.getElementById("roomInput").value.trim();
  if (id.length === 0) {
    alert("Please enter a valid Room ID.");
    return;
  }
  socket.emit("joinRoom", { roomId: id, name });
}

function showOnlineMenu() {
  document.getElementById("onlineMenu").classList.remove("hidden");
}

socket.on("roomCreated", (id) => {
  roomId = id;
  gameMode = "online";
  playerIndex = 1;
  isMyTurn = true;
  document.getElementById("mainMenu").classList.add("hidden");
  document.getElementById("waitingScreen").classList.remove("hidden");
  alert(`Room created. Share this Room ID: ${id}`);
});

socket.on("roomJoined", ({ roomId: id, playerNames: names, playerIndex: index }) => {
  roomId = id;
  gameMode = "online";
  playerIndex = index;
  isMyTurn = index === 1;
  Object.assign(playerNames, names);
  setupGameUI(playerNames[1], playerNames[2]);
});

socket.on("move", ({ move }) => {
  const { from, to } = move;
  movePiece(...from, ...to);
  drawBoard();
});

function aiMove() {
  setTimeout(() => {
    const moves = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 2) {
          getValidMoves(r, c).forEach(([rr, cc]) => {
            moves.push({ from: [r, c], to: [rr, cc] });
          });
        }
      }
    }
    const best = moves[Math.floor(Math.random() * moves.length)];
    if (best) movePiece(...best.from, ...best.to);
    drawBoard();
    checkWin();
  }, 800);
}
