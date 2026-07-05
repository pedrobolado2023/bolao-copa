/* ==========================================
   CONSTANTS & STATE MANAGEMENT
   ========================================== */
const DEFAULT_ADMIN_PIN = "admin123";
// Token configurado via painel admin ou variável de ambiente no servidor.
// Não colocar credenciais aqui — o token real fica em server.js.
const DEFAULT_MP_TOKEN = "";

// URL do backend. Em desenvolvimento local com server.js, usa mesma porta.
// Em produção, aponta para o servidor.
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin;

// Predefined football nations with flag codes for FlagCDN (https://flagcdn.com/)
const TEAMS_LIST = [
    { name: "Alemanha", code: "de" },
    { name: "Argélia", code: "dz" },
    { name: "Arábia Saudita", code: "sa" },
    { name: "Argentina", code: "ar" },
    { name: "Austrália", code: "au" },
    { name: "Áustria", code: "at" },
    { name: "Bélgica", code: "be" },
    { name: "Bósnia e Herzegovina", code: "ba" },
    { name: "Brasil", code: "br" },
    { name: "Cabo Verde", code: "cv" },
    { name: "Camarões", code: "cm" },
    { name: "Canadá", code: "ca" },
    { name: "Catar", code: "qa" },
    { name: "Colômbia", code: "co" },
    { name: "Congo RD", code: "cd" },
    { name: "Coreia do Sul", code: "kr" },
    { name: "Costa do Marfim", code: "ci" },
    { name: "Croácia", code: "hr" },
    { name: "Curaçao", code: "cw" },
    { name: "Dinamarca", code: "dk" },
    { name: "Egito", code: "eg" },
    { name: "Equador", code: "ec" },
    { name: "Espanha", code: "es" },
    { name: "Estados Unidos", code: "us" },
    { name: "França", code: "fr" },
    { name: "Gana", code: "gh" },
    { name: "Haiti", code: "ht" },
    { name: "Holanda", code: "nl" },
    { name: "Inglaterra", code: "gb" },
    { name: "Iraque", code: "iq" },
    { name: "Irã", code: "ir" },
    { name: "Itália", code: "it" },
    { name: "Japão", code: "jp" },
    { name: "Jordânia", code: "jo" },
    { name: "Marrocos", code: "ma" },
    { name: "México", code: "mx" },
    { name: "Noruega", code: "no" },
    { name: "Nova Zelândia", code: "nz" },
    { name: "Panamá", code: "pa" },
    { name: "Paraguai", code: "py" },
    { name: "Portugal", code: "pt" },
    { name: "Senegal", code: "sn" },
    { name: "África do Sul", code: "za" },
    { name: "Suécia", code: "se" },
    { name: "Suíça", code: "ch" },
    { name: "Tunísia", code: "tn" },
    { name: "Turquia", code: "tr" },
    { name: "Uruguai", code: "uy" },
    { name: "Uzbequistão", code: "uz" }
].sort((a, b) => a.name.localeCompare(b.name));

// Global Application State (Loaded from localStorage or initialized)
let games = JSON.parse(localStorage.getItem("bolao_games")) || [];
let bets = JSON.parse(localStorage.getItem("bolao_bets")) || [];
let participantsPix = JSON.parse(localStorage.getItem("bolao_participants_pix")) || {};
let pricePerGame = parseFloat(localStorage.getItem("bolao_price_per_game")) || 5.00;
let mpToken = localStorage.getItem("bolao_mp_token") || DEFAULT_MP_TOKEN;
let manualPixKey = localStorage.getItem("bolao_manual_pix_key") || "financeiro@empresa.com";
const isSimulatorMode = false;
const mockPaymentApproved = false;

// Local storage session for the user's name
let loggedUserName = localStorage.getItem("bolao_user_name") || "";
let loggedUserEmail = localStorage.getItem("bolao_user_email") || "";
let loggedUserWhatsapp = localStorage.getItem("bolao_user_whatsapp") || "";

// Temporary Cart/Checkout state
let tempBets = {}; // Keyed by predictionId: { predictionId, gameId, betScoreA, betScoreB }
let pollingIntervalId = null;

// Active Filter and Tab
let activeTab = "jogos";
let activeFilter = "todos";
let isAdminLoggedIn = false;

// ==========================================
// INITIAL DATABASE POPULATION (Mock data)
// ==========================================
function setupMockDataIfEmpty() {
    // Banco de dados inicia limpo - apenas jogos cadastrados pelo administrador serão exibidos
}

async function loadDataFromDatabase() {
    try {
        const gamesRes = await fetch(`${BACKEND_URL}/api/games`);
        if (gamesRes.ok) {
            const serverGames = await gamesRes.json();
            games = serverGames.map(g => ({
                id: g.id,
                teamA: g.team_a,
                teamB: g.team_b,
                dateTime: g.date_time,
                scoreA: g.score_a,
                scoreB: g.score_b
            }));
            localStorage.setItem("bolao_games", JSON.stringify(games));
        }

        const betsRes = await fetch(`${BACKEND_URL}/api/bets`);
        if (betsRes.ok) {
            bets = await betsRes.json();
            localStorage.setItem("bolao_bets", JSON.stringify(bets));
            
            participantsPix = {};
            bets.forEach(b => {
                participantsPix[b.participantName] = true;
            });
            localStorage.setItem("bolao_participants_pix", JSON.stringify(participantsPix));
        }

        renderGames();
        renderRanking();
    } catch (err) {
        console.error("Erro ao carregar dados do servidor:", err);
    }
}

function saveToLocalStorage() {
    localStorage.setItem("bolao_games", JSON.stringify(games));
    localStorage.setItem("bolao_bets", JSON.stringify(bets));
    localStorage.setItem("bolao_participants_pix", JSON.stringify(participantsPix));
    localStorage.setItem("bolao_price_per_game", pricePerGame.toString());
    localStorage.setItem("bolao_mp_token", mpToken);
    localStorage.setItem("bolao_manual_pix_key", manualPixKey);
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function getTeamFlagUrl(teamName) {
    const team = TEAMS_LIST.find(t => t.name.toLowerCase() === teamName.toLowerCase());
    if (team) {
        return `https://flagcdn.com/w80/${team.code}.png`;
    }
    return `https://flagcdn.com/w80/un.png`; 
}

function formatDateTime(dateTimeString) {
    const dt = new Date(dateTimeString);
    return dt.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");
    toastMsg.textContent = message;
    
    if (type === "success") {
        toast.style.borderColor = "var(--accent-green)";
    } else if (type === "error") {
        toast.style.borderColor = "var(--accent-danger)";
    } else {
        toast.style.borderColor = "var(--accent-blue)";
    }

    toast.classList.add("show");
    
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

// UUID generator for Mercado Pago idempotency key
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ==========================================
// PONTUATION ENGINE
// ==========================================
function calculatePoints(bet, game) {
    if (game.scoreA === null || game.scoreB === null) return 0;
    
    const bA = parseInt(bet.betScoreA);
    const bB = parseInt(bet.betScoreB);
    const gA = parseInt(game.scoreA);
    const gB = parseInt(game.scoreB);
    
    // 1. Placar Exato -> 10 pontos
    if (bA === gA && bB === gB) {
        return 10;
    }
    
    const betOutcome = Math.sign(bA - bB);   // 1 (A wins), -1 (B wins), 0 (draw)
    const gameOutcome = Math.sign(gA - gB);  // 1 (A wins), -1 (B wins), 0 (draw)
    
    // 2. Acertou Vencedor ou Empate
    if (betOutcome === gameOutcome) {
        const betDiff = bA - bB;
        const gameDiff = gA - gB;
        // Acertou Vencedor + Saldo de Gols -> 7 pontos
        if (betDiff === gameDiff) {
            return 7;
        }
        // Acertou Apenas o Vencedor -> 5 pontos
        return 5;
    }
    
    // 3. Errou resultado, mas acertou os gols de um dos times -> 2 pontos
    if (bA === gA || bB === gB) {
        return 2;
    }
    
    return 0;
}

function isGameLocked(game) {
    const gameTime = new Date(game.dateTime).getTime();
    const curTime = new Date().getTime();
    // Encerra apostas 5 minutos antes do início (5 * 60 * 1000 = 300000ms)
    return curTime >= (gameTime - 5 * 60 * 1000);
}

function checkGameLockStatus() {
    let stateChanged = false;
    games.forEach(game => {
        if (game.scoreA === null && game.scoreB === null) {
            const locked = isGameLocked(game);
            const currentCard = document.querySelector(`.game-card[data-id="${game.id}"]`);
            if (locked && currentCard && currentCard.classList.contains("status-open")) {
                stateChanged = true;
            }
        }
    });
    if (stateChanged) {
        renderGames();
    }
}

// ==========================================
// RENDER & SCREEN UPDATING
// ==========================================

function populateTeamSelects() {
    const selects = [document.getElementById("teamAName"), document.getElementById("teamBName")];
    selects.forEach(select => {
        select.innerHTML = '<option value="">Selecione...</option>';
        TEAMS_LIST.forEach(team => {
            const option = document.createElement("option");
            option.value = team.name;
            option.textContent = team.name;
            select.appendChild(option);
        });
    });
}

function renderGames() {
    const gamesGrid = document.getElementById("gamesGrid");
    gamesGrid.innerHTML = "";

    const sortedGames = [...games].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    
    const filteredGames = sortedGames.filter(game => {
        const locked = isGameLocked(game);
        const finished = game.scoreA !== null && game.scoreB !== null;
        
        if (activeFilter === "abertos") return !locked && !finished;
        if (activeFilter === "fechados") return locked && !finished;
        if (activeFilter === "finalizados") return finished;
        return true;
    });

    if (filteredGames.length === 0) {
        gamesGrid.innerHTML = `
            <div class="no-data-placeholder">
                <i data-lucide="calendar-off"></i>
                <p>Nenhum jogo nesta categoria.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    filteredGames.forEach(game => {
        const locked = isGameLocked(game);
        const finished = game.scoreA !== null && game.scoreB !== null;
        
        const card = document.createElement("div");
        card.setAttribute("data-id", game.id);
        
        let cardStatusClass = "status-open";
        let badgeHTML = `<span class="status-badge open"><span class="pulse-dot"></span> Aberto</span>`;
        
        if (finished) {
            cardStatusClass = "status-finished";
            badgeHTML = `<span class="status-badge finished">Finalizado</span>`;
        } else if (locked) {
            cardStatusClass = "status-locked";
            badgeHTML = `<span class="status-badge locked"><i data-lucide="lock"></i> Fechado</span>`;
        }
        card.className = `game-card ${cardStatusClass}`;

        let subtitleHTML = "";
        if (finished) {
            subtitleHTML = `<div class="game-date"><i data-lucide="calendar"></i> ${formatDateTime(game.dateTime)}</div>`;
        } else if (locked) {
            subtitleHTML = `<div class="game-date"><i data-lucide="play-circle"></i> Em andamento</div>`;
        } else {
            subtitleHTML = `
                <div class="countdown-timer" data-target="${game.dateTime}">
                    <i data-lucide="clock"></i> <span class="timer-value">Carregando...</span>
                </div>
            `;
        }

        // Check if current user has already submitted a paid prediction for this game
        let userHasPaidBet = false;
        let paidPredictions = [];

        if (loggedUserName) {
            const nameUpper = loggedUserName.trim().toUpperCase();
            paidPredictions = bets.filter(b => {
                const pName = b.participantName.trim().toUpperCase();
                return b.gameId === game.id && 
                       (pName === nameUpper || pName.startsWith(nameUpper + " #")) && 
                       participantsPix[pName] === true;
            });
            if (paidPredictions.length > 0) {
                userHasPaidBet = true;
            }
        }

        // Score area rendering logic
        let scoresContentHTML = "";
        let actionHTML = "";

        if (finished) {
            scoresContentHTML = `
                <div class="bet-inputs-row">
                    <span class="score-display">${game.scoreA}</span>
                    <span class="score-dash">-</span>
                    <span class="score-display">${game.scoreB}</span>
                </div>
            `;
            actionHTML = `
                <button class="btn btn-secondary btn-block view-bets-btn" onclick="openBetsDetailModal('${game.id}')">
                    <i data-lucide="eye"></i> Ver Palpites
                </button>
            `;
        } else if (locked) {
            scoresContentHTML = `
                <div class="bet-inputs-row">
                    <span class="score-display">-</span>
                    <span class="score-dash">x</span>
                    <span class="score-display">-</span>
                </div>
            `;
            actionHTML = `
                <button class="btn btn-secondary btn-block view-bets-btn" onclick="openBetsDetailModal('${game.id}')">
                    <i data-lucide="eye"></i> Ver Palpites
                </button>
            `;
        } else if (userHasPaidBet) {
            // Render all paid predictions for this game
            scoresContentHTML = paidPredictions.map(p => `
                <div class="bet-inputs-row" style="margin-bottom: 6px;">
                    <span class="score-display" style="color: var(--accent-green); font-size: 1.25rem;">${p.betScoreA}</span>
                    <span class="score-dash" style="font-size: 1rem;">-</span>
                    <span class="score-display" style="color: var(--accent-green); font-size: 1.25rem;">${p.betScoreB}</span>
                </div>
            `).join("");
            actionHTML = `
                <div class="submitted-badge" style="color: var(--accent-green); font-weight: 500; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> ${paidPredictions.length} ${paidPredictions.length > 1 ? 'Palpites Confirmados' : 'Palpite Confirmado'} & Pago
                </div>
            `;
        } else {
            // Open for input. Retrieve all temporary predictions for this game
            const gamePreds = Object.values(tempBets).filter(b => b.gameId === game.id);
            if (gamePreds.length === 0) {
                // Default to 1 empty prediction row if none exist
                gamePreds.push({ predictionId: `${game.id}_0`, gameId: game.id, betScoreA: "", betScoreB: "" });
            }

            scoresContentHTML = `
                <div class="predictions-rows-container" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                    ${gamePreds.map((pred, idx) => {
                        const tempValA = pred.betScoreA !== undefined && pred.betScoreA !== "" ? pred.betScoreA : "";
                        const tempValB = pred.betScoreB !== undefined && pred.betScoreB !== "" ? pred.betScoreB : "";
                        const showDelete = idx > 0;
                        return `
                            <div class="bet-inputs-row" id="row-${pred.predictionId}" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <input type="number" min="0" max="99" class="score-input input-score-a" id="bet-a-${pred.predictionId}" placeholder="0" value="${tempValA}" oninput="onScoreInputChanged('${pred.predictionId}', '${game.id}')" style="width: 55px; text-align: center;">
                                <span class="score-dash">x</span>
                                <input type="number" min="0" max="99" class="score-input input-score-b" id="bet-b-${pred.predictionId}" placeholder="0" value="${tempValB}" oninput="onScoreInputChanged('${pred.predictionId}', '${game.id}')" style="width: 55px; text-align: center;">
                                ${showDelete ? `
                                    <button type="button" class="btn-remove-pred" onclick="removePredictionRow('${pred.predictionId}')" style="background: none; border: none; color: #ff5252; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 2px;">
                                        <i data-lucide="minus-circle" style="width: 18px; height: 18px;"></i>
                                    </button>
                                ` : `
                                    <div style="width: 22px;"></div>
                                `}
                            </div>
                        `;
                    }).join("")}
                </div>
            `;

            actionHTML = `
                <div class="predictions-actions" style="margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="addNewPredictionRow('${game.id}')" style="padding: 4px 8px; font-size: 0.75rem; display: flex; align-items: center; gap: 4px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.15); color: var(--text-secondary); width: auto; cursor: pointer;">
                        <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Outro palpite para este jogo
                    </button>
                    <div class="participant-input-area" style="text-align: center; color: var(--text-muted); font-size: 0.7rem;">
                        Palpites salvos temporariamente no rodapé.
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="card-meta">
                ${badgeHTML}
                ${subtitleHTML}
            </div>
            <div class="match-area">
                <div class="team-display">
                    <img src="${getTeamFlagUrl(game.teamA)}" class="team-flag" alt="${game.teamA}">
                    <span class="team-name" title="${game.teamA}">${game.teamA}</span>
                </div>
                <div class="vs-divider">VS</div>
                <div class="team-display">
                    <img src="${getTeamFlagUrl(game.teamB)}" class="team-flag" alt="${game.teamB}">
                    <span class="team-name" title="${game.teamB}">${game.teamB}</span>
                </div>
            </div>
            ${scoresContentHTML}
            ${actionHTML}
        `;
        
        gamesGrid.appendChild(card);
    });

    lucide.createIcons();
    updateCountdownTimers();
}

function updateCountdownTimers() {
    const timers = document.querySelectorAll(".countdown-timer");
    timers.forEach(timer => {
        const targetStr = timer.getAttribute("data-target");
        const targetDate = new Date(targetStr).getTime();
        
        function update() {
            const now = new Date().getTime();
            // A contagem regressiva encerra 5 minutos antes do início
            const diff = (targetDate - 5 * 60 * 1000) - now;
            
            if (diff <= 0) {
                timer.innerHTML = '<i data-lucide="lock"></i> Fechado';
                lucide.createIcons();
                return;
            }
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const valueSpan = timer.querySelector(".timer-value");
            if (valueSpan) {
                valueSpan.textContent = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
            }
        }
        
        update();
    });
}

function renderRanking() {
    const rankingBody = document.getElementById("rankingBody");
    rankingBody.innerHTML = "";

    const participants = {};
    
    bets.forEach(b => {
        const name = b.participantName.trim().toUpperCase();
        if (!participants[name]) {
            participants[name] = {
                name: name,
                points: 0,
                exacts: 0,
                diffs: 0, 
                wins: 0,   
                goals: 0   
            };
        }
    });
    
    Object.keys(participantsPix).forEach(name => {
        const nameUpper = name.trim().toUpperCase();
        if (!participants[nameUpper]) {
            participants[nameUpper] = {
                name: nameUpper,
                points: 0,
                exacts: 0,
                diffs: 0,
                wins: 0,
                goals: 0
            };
        }
    });

    bets.forEach(bet => {
        const game = games.find(g => g.id === bet.gameId);
        if (game && game.scoreA !== null && game.scoreB !== null) {
            const name = bet.participantName.trim().toUpperCase();
            const pts = calculatePoints(bet, game);
            participants[name].points += pts;
            
            if (pts === 10) participants[name].exacts++;
            else if (pts === 7) participants[name].diffs++;
            else if (pts === 5) participants[name].wins++;
            else if (pts === 2) participants[name].goals++;
        }
    });

    const sortedParticipants = Object.values(participants).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exacts !== a.exacts) return b.exacts - a.exacts;
        if (b.diffs !== a.diffs) return b.diffs - a.diffs;
        return b.wins - a.wins;
    });

    const currentLeaderNameEl = document.getElementById("currentLeaderName");
    
    const totalFinishedGames = games.filter(g => g.scoreA !== null && g.scoreB !== null).length;
    const allGamesFinished = games.length > 0 && totalFinishedGames === games.length;

    if (sortedParticipants.length > 0) {
        const topParticipant = sortedParticipants[0];
        
        if (allGamesFinished) {
            document.getElementById("headerLeader").style.background = "rgba(0, 255, 136, 0.15)";
            document.getElementById("headerLeader").style.borderColor = "var(--accent-green)";
            document.querySelector("#headerLeader .badge-label").innerHTML = '<i data-lucide="crown"></i> Campeão 🏆';
            currentLeaderNameEl.textContent = `${topParticipant.name} (${topParticipant.points} pts)`;
        } else {
            document.getElementById("headerLeader").style.background = "rgba(245, 197, 24, 0.1)";
            document.getElementById("headerLeader").style.borderColor = "rgba(245, 197, 24, 0.3)";
            document.querySelector("#headerLeader .badge-label").innerHTML = '<i data-lucide="crown"></i> Líder Atual';
            currentLeaderNameEl.textContent = `${topParticipant.name} (${topParticipant.points} pts)`;
        }
    } else {
        currentLeaderNameEl.textContent = "Nenhum palpite";
    }

    if (sortedParticipants.length === 0) {
        rankingBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 40px;">
                    Nenhum palpite registrado ainda.
                </td>
            </tr>
        `;
        return;
    }

    sortedParticipants.forEach((part, index) => {
        const isPaid = participantsPix[part.name] === true;
        const pixBadgeHTML = isPaid 
            ? `<span class="pix-status-badge paid"><i data-lucide="check-circle"></i> Confirmado</span>`
            : `<span class="pix-status-badge pending"><i data-lucide="clock"></i> Pendente</span>`;
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <div class="rank-badge">${index + 1}</div>
            </td>
            <td>
                <div class="participant-name-cell">
                    ${part.name} ${index === 0 ? '👑' : ''}
                </div>
            </td>
            <td class="points-cell">${part.points}</td>
            <td class="stat-cell">${part.exacts}</td>
            <td class="stat-cell">${part.diffs}</td>
            <td class="stat-cell">${part.wins}</td>
            <td>${pixBadgeHTML}</td>
        `;
        rankingBody.appendChild(row);
    });

    lucide.createIcons();
}

function renderPixInfoPanel() {
    document.getElementById("infoPricePerGame").textContent = `R$ ${pricePerGame.toFixed(2).replace('.', ',')}`;
    document.getElementById("infoPixKey").textContent = manualPixKey;
}

// ==========================================
// BETTING CART / CARRINHO ENGINE
// ==========================================
window.onScoreInputChanged = function(predictionId, gameId) {
    const inputA = document.getElementById(`bet-a-${predictionId}`);
    const inputB = document.getElementById(`bet-b-${predictionId}`);
    
    if (!inputA || !inputB) return;
    
    const valA = inputA.value.trim();
    const valB = inputB.value.trim();
    
    if (valA !== "" && valB !== "") {
        // Both filled -> store in temporary cart state
        tempBets[predictionId] = {
            predictionId: predictionId,
            gameId: gameId,
            betScoreA: parseInt(valA),
            betScoreB: parseInt(valB)
        };
    } else {
        // Cut out if one of them is empty
        delete tempBets[predictionId];
    }
    
    updateCartBar();
};

window.addNewPredictionRow = function(gameId) {
    // Find next index for this game
    const gameKeys = Object.keys(tempBets).filter(k => k.startsWith(`${gameId}_`));
    let nextIndex = 0;
    if (gameKeys.length > 0) {
        const indices = gameKeys.map(k => parseInt(k.split("_")[1]) || 0);
        nextIndex = Math.max(...indices) + 1;
    } else {
        nextIndex = 1;
    }
    
    const newPredId = `${gameId}_${nextIndex}`;
    tempBets[newPredId] = {
        predictionId: newPredId,
        gameId: gameId,
        betScoreA: "",
        betScoreB: ""
    };
    
    renderGames();
    updateCartBar();
};

window.removePredictionRow = function(predictionId) {
    delete tempBets[predictionId];
    renderGames();
    updateCartBar();
};

function updateCartBar() {
    const cartBar = document.getElementById("cartBar");
    const badgeCount = document.getElementById("cartBadgeCount");
    const titleText = document.getElementById("cartTitleText");
    const subtitleText = document.getElementById("cartSubtitleText");
    const totalPriceEl = document.getElementById("cartTotalPrice");
    const checkoutBtn = document.getElementById("checkoutBtn");
    
    const count = Object.keys(tempBets).length;
    
    if (count > 0) {
        cartBar.classList.add("active");
        badgeCount.textContent = count;
        titleText.textContent = `${count} palpite${count > 1 ? 's' : ''} preenchido${count > 1 ? 's' : ''}`;
        subtitleText.textContent = "Finalize clicando em Enviar e Pagar";
        
        const total = count * pricePerGame;
        totalPriceEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        checkoutBtn.removeAttribute("disabled");
    } else {
        cartBar.classList.remove("active");
        checkoutBtn.setAttribute("disabled", "true");
    }
}

// ==========================================
// CHECKOUT & MERCADO PAGO INTEGRATION
// ==========================================
function renderCheckoutSummary() {
    const summaryList = document.getElementById("checkoutSummaryList");
    const summaryTotalBets = document.getElementById("summaryTotalBets");
    const checkoutTotalText = document.getElementById("checkoutTotalText");
    
    summaryList.innerHTML = "";
    const betKeys = Object.keys(tempBets);
    
    summaryTotalBets.textContent = betKeys.length;
    
    betKeys.forEach(predId => {
        const pred = tempBets[predId];
        const game = games.find(g => g.id === pred.gameId);
        if (game) {
            const item = document.createElement("div");
            item.className = "summary-item";
            item.innerHTML = `
                <span>${game.teamA} x ${game.teamB}</span>
                <span class="summary-score">${pred.betScoreA} x ${pred.betScoreB}</span>
            `;
            summaryList.appendChild(item);
        }
    });
    
    const total = betKeys.length * pricePerGame;
    checkoutTotalText.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// Initiate checkout modal steps
function showCheckoutStep(stepId) {
    const steps = ["checkoutFormStep", "checkoutPixStep", "checkoutSuccessStep"];
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (id === stepId) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });
}

// Trigger payment call to Mercado Pago API (via backend para evitar CORS)
async function createMercadoPagoPixPayment(name, email, value, whatsapp) {
    if (isSimulatorMode) {
        mockPaymentApproved = false;
        // Simulate minor API delay for visual consistency
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
            id: "sim-" + Date.now(),
            point_of_interaction: {
                transaction_data: {
                    qr_code: "00020126580014br.gov.bcb.pix2536" + manualPixKey + "520400005303986540" + value.toFixed(2) + "5802BR5913Arena Bolao6009Sao Paulo62070503***6304",
                    qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABgCl8PAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAnklEQVRIie2WsQ7DIAxFXyVSpUqnSpUqlSpVKpUqVSpVqtT//xESpUqVSpUqlSpVKlUqlSpVKlUqlSpV/v9FhMv4MEC73S6n0+n0u9tuf98A8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw//j4Hk6KxW24B90AAAAASUVORK5CYII="
                }
            },
            status: "pending"
        };
    }

    // Chama o backend local (sem CORS, token protegido no servidor)
    const response = await fetch(`${BACKEND_URL}/api/pix/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: name,
            email: email,
            whatsapp: whatsapp || "",
            amount: value,
            description: `Bolão da Copa 2026 - ${name}`,
            bets: Object.values(tempBets)
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || "Erro ao criar pagamento PIX");
    }

    // Adaptar resposta do backend para o formato esperado pelo front-end
    return {
        id: data.paymentId,
        point_of_interaction: {
            transaction_data: {
                qr_code: data.qrCode,
                qr_code_base64: data.qrCodeBase64
            }
        },
        status: data.status
    };
}

// Check the payment status via backend (sem CORS)
async function checkMpPaymentStatus(paymentId) {
    if (isSimulatorMode || (paymentId && paymentId.toString().startsWith("sim-"))) {
        return mockPaymentApproved ? "approved" : "pending";
    }

    const response = await fetch(`${BACKEND_URL}/api/pix/status/${paymentId}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error("Erro ao consultar status de pagamento");
    }

    return data.status; // "pending", "approved", "rejected", etc.
}

// Start polling status loop
function startPaymentPolling(paymentId, name, email, whatsapp) {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
    }
    
    const startTime = Date.now();
    const expirationDuration = 5 * 60 * 1000; // 5 minutos de expiração
    const timerElement = document.getElementById("pixExpirationTimer");
    if (timerElement) {
        timerElement.textContent = "O código expira em: 05:00";
        timerElement.style.color = "var(--accent-yellow)";
    }
    
    pollingIntervalId = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        const remaining = expirationDuration - elapsed;

        if (remaining <= 0) {
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
            if (timerElement) {
                timerElement.textContent = "Código PIX expirado!";
                timerElement.style.color = "var(--accent-red)";
            }
            showToast("O tempo limite de 5 minutos para pagamento do PIX expirou. Por favor, envie os palpites novamente.", "error");
            setTimeout(() => {
                const checkoutModal = document.getElementById("checkoutModal");
                if (checkoutModal) {
                    checkoutModal.classList.remove("active");
                }
            }, 4000);
            return;
        }

        const remainingSeconds = Math.max(0, Math.floor(remaining / 1000));
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        if (timerElement) {
            timerElement.textContent = `O código expira em: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        try {
            const status = await checkMpPaymentStatus(paymentId);
            if (status === "approved") {
                clearInterval(pollingIntervalId);
                pollingIntervalId = null;
                
                // Save user details
                loggedUserName = name;
                loggedUserEmail = email;
                loggedUserWhatsapp = whatsapp;
                localStorage.setItem("bolao_user_name", name);
                localStorage.setItem("bolao_user_email", email);
                localStorage.setItem("bolao_user_whatsapp", whatsapp);
                
                // Determine max ticket index in tempBets to check if we need suffixes (#1, #2, ...)
                let maxIndex = 0;
                Object.values(tempBets).forEach(tBet => {
                    const idx = parseInt(tBet.predictionId.split("_")[1]) || 0;
                    if (idx > maxIndex) maxIndex = idx;
                });
                
                // Commit temporary bets into the database
                Object.values(tempBets).forEach(tBet => {
                    const idx = parseInt(tBet.predictionId.split("_")[1]) || 0;
                    const participantSuffix = maxIndex > 0 ? ` #${idx + 1}` : "";
                    const finalParticipantName = (name + participantSuffix).toUpperCase();
                    
                    const existingBetIndex = bets.findIndex(b => b.gameId === tBet.gameId && b.participantName.trim().toUpperCase() === finalParticipantName);
                    
                    const newBet = {
                        id: existingBetIndex !== -1 ? bets[existingBetIndex].id : "b-" + Date.now() + "-" + Math.random().toString(36).substring(2, 5),
                        gameId: tBet.gameId,
                        participantName: finalParticipantName,
                        betScoreA: tBet.betScoreA,
                        betScoreB: tBet.betScoreB
                    };
                    
                    if (existingBetIndex !== -1) {
                        bets[existingBetIndex] = newBet;
                    } else {
                        bets.push(newBet);
                    }
                    
                    // Set payment confirmation for this participant entry
                    participantsPix[finalParticipantName] = true;
                });
                
                saveToLocalStorage();
                
                // Clear cart
                tempBets = {};
                updateCartBar();
                
                // Show Success Screen
                showCheckoutStep("checkoutSuccessStep");
                showToast("Pagamento recebido e palpites validados!", "success");
                
                renderGames();
                renderRanking();
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
    }, 3000);
}

// ==========================================
// ADMIN LOGIC & OPERATIONS
// ==========================================

function renderAdminGames() {
    const adminGamesList = document.getElementById("adminGamesList");
    adminGamesList.innerHTML = "";

    if (games.length === 0) {
        adminGamesList.innerHTML = "<p class='help-text'>Nenhum jogo cadastrado.</p>";
        return;
    }

    const sortedGames = [...games].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    sortedGames.forEach(game => {
        const finished = game.scoreA !== null && game.scoreB !== null;
        
        const row = document.createElement("div");
        row.className = "admin-game-row";
        
        let scoreDisplay = "";
        let actionsHTML = "";

        if (finished) {
            scoreDisplay = `<span class="score-display">${game.scoreA} - ${game.scoreB}</span>`;
            actionsHTML = `
                <button class="btn btn-secondary btn-sm" onclick="reopenGame('${game.id}')">
                    <i data-lucide="rotate-ccw"></i> Refazer Placar
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteGame('${game.id}')">
                    <i data-lucide="trash-2"></i> Excluir
                </button>
            `;
        } else {
            scoreDisplay = `
                <div class="admin-game-score-inputs">
                    <input type="number" min="0" id="final-a-${game.id}" placeholder="Gol A" class="score-input" style="width: 60px; height: 32px; font-size: 0.9rem;">
                    <span>x</span>
                    <input type="number" min="0" id="final-b-${game.id}" placeholder="Gol B" class="score-input" style="width: 60px; height: 32px; font-size: 0.9rem;">
                </div>
            `;
            actionsHTML = `
                <button class="btn btn-success btn-sm" onclick="finalizeGame('${game.id}')">
                    <i data-lucide="check"></i> Finalizar
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteGame('${game.id}')">
                    <i data-lucide="trash-2"></i> Excluir
                </button>
            `;
        }

        row.innerHTML = `
            <div class="admin-game-info">
                <img src="${getTeamFlagUrl(game.teamA)}" class="team-flag" style="width:24px; height:16px;">
                <span>${game.teamA}</span>
                ${scoreDisplay}
                <span>${game.teamB}</span>
                <img src="${getTeamFlagUrl(game.teamB)}" class="team-flag" style="width:24px; height:16px;">
                <span class="help-text">(${formatDateTime(game.dateTime)})</span>
            </div>
            <div class="admin-game-actions">
                ${actionsHTML}
            </div>
        `;
        adminGamesList.appendChild(row);
    });

    lucide.createIcons();
}

function renderAdminBets() {
    const adminBetsTableBody = document.getElementById("adminBetsTableBody");
    adminBetsTableBody.innerHTML = "";

    const participants = {};
    bets.forEach(b => {
        const name = b.participantName.trim().toUpperCase();
        participants[name] = true;
    });
    
    Object.keys(participantsPix).forEach(name => {
        participants[name.trim().toUpperCase()] = true;
    });

    const participantList = Object.keys(participants).sort();

    if (participantList.length === 0) {
        adminBetsTableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding: 20px; color: var(--text-secondary);">
                    Nenhum participante registrado.
                </td>
            </tr>
        `;
        return;
    }

    participantList.forEach(name => {
        const isPaid = participantsPix[name] === true;
        const toggleBtnHTML = isPaid
            ? `<button class="btn btn-secondary btn-sm" onclick="togglePixStatus('${name}', false)"><i data-lucide="x-circle"></i> Marcar Pendente</button>`
            : `<button class="btn btn-success btn-sm" onclick="togglePixStatus('${name}', true)"><i data-lucide="check-circle"></i> Confirmar Pago</button>`;

        let totalPoints = 0;
        bets.filter(b => b.participantName.trim().toUpperCase() === name).forEach(bet => {
            const game = games.find(g => g.id === bet.gameId);
            if (game && game.scoreA !== null && game.scoreB !== null) {
                totalPoints += calculatePoints(bet, game);
            }
        });

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${name}</strong></td>
            <td>${totalPoints} pts</td>
            <td>
                ${isPaid 
                    ? `<span class="pix-status-badge paid"><i data-lucide="check-circle"></i> Confirmado</span>`
                    : `<span class="pix-status-badge pending"><i data-lucide="clock"></i> Pendente</span>`
                }
            </td>
            <td>
                <div style="display:flex; gap:8px;">
                    ${toggleBtnHTML}
                    <button class="btn btn-danger btn-sm" onclick="deleteParticipant('${name}')">
                        <i data-lucide="trash"></i> Remover
                    </button>
                </div>
            </td>
        `;
        adminBetsTableBody.appendChild(row);
    });

    lucide.createIcons();
}

window.finalizeGame = async function(gameId) {
    const inputA = document.getElementById(`final-a-${gameId}`);
    const inputB = document.getElementById(`final-b-${gameId}`);
    const valA = inputA.value.trim();
    const valB = inputB.value.trim();

    if (valA === "" || valB === "") {
        showToast("Insira o placar oficial antes de finalizar o jogo.", "error");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/games/${gameId}/score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-password": "admin123"
            },
            body: JSON.stringify({
                score_a: parseInt(valA),
                score_b: parseInt(valB)
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Erro ao salvar no servidor");
        }

        const gameIndex = games.findIndex(g => g.id === gameId);
        if (gameIndex !== -1) {
            games[gameIndex].scoreA = parseInt(valA);
            games[gameIndex].scoreB = parseInt(valB);
            showToast(`Placar oficial salvo: ${games[gameIndex].teamA} ${valA} x ${valB} ${games[gameIndex].teamB}!`, "success");
            saveToLocalStorage();
            renderGames();
            renderRanking();
            renderAdminGames();
            renderAdminBets();
        }
    } catch (error) {
        console.error(error);
        showToast(`Erro ao finalizar jogo: ${error.message}`, "error");
    }
};

window.reopenGame = async function(gameId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/games/${gameId}/score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-password": "admin123"
            },
            body: JSON.stringify({
                score_a: null,
                score_b: null
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Erro ao salvar no servidor");
        }

        const gameIndex = games.findIndex(g => g.id === gameId);
        if (gameIndex !== -1) {
            games[gameIndex].scoreA = null;
            games[gameIndex].scoreB = null;
            showToast("Placar removido.", "info");
            saveToLocalStorage();
            renderGames();
            renderRanking();
            renderAdminGames();
            renderAdminBets();
        }
    } catch (error) {
        console.error(error);
        showToast(`Erro ao reabrir jogo: ${error.message}`, "error");
    }
};

window.deleteGame = async function(gameId) {
    if (confirm("Deseja excluir este jogo? Os palpites serão apagados.")) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/games/${gameId}`, {
                method: "DELETE",
                headers: {
                    "x-admin-password": "admin123"
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erro ao excluir no servidor");
            }

            games = games.filter(g => g.id !== gameId);
            bets = bets.filter(b => b.gameId !== gameId);
            showToast("Jogo excluído.", "info");
            saveToLocalStorage();
            renderGames();
            renderRanking();
            renderAdminGames();
            renderAdminBets();
        } catch (error) {
            console.error(error);
            showToast(`Erro ao excluir jogo: ${error.message}`, "error");
        }
    }
};

window.togglePixStatus = function(participantName, isPaid) {
    participantsPix[participantName.trim().toUpperCase()] = isPaid;
    showToast(`Status PIX de ${participantName} alterado!`, "success");
    saveToLocalStorage();
    renderRanking();
    renderAdminBets();
};

window.deleteParticipant = function(participantName) {
    const nameUpper = participantName.trim().toUpperCase();
    if (confirm(`Remover participante "${nameUpper}"?`)) {
        bets = bets.filter(b => b.participantName.trim().toUpperCase() !== nameUpper);
        delete participantsPix[nameUpper];
        showToast(`Participante ${nameUpper} removido.`, "info");
        saveToLocalStorage();
        renderGames();
        renderRanking();
        renderAdminBets();
    }
};

// ==========================================
// DETAILS MODAL FOR CLOSED GAMES
// ==========================================
window.openBetsDetailModal = function(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const modal = document.getElementById("betsDetailModal");
    const title = document.getElementById("betsDetailTitle");
    const alertBox = document.getElementById("betsDetailAlert");
    const tbody = document.getElementById("betsDetailTableBody");

    title.textContent = `Palpites - ${game.teamA} x ${game.teamB}`;
    tbody.innerHTML = "";

    const locked = isGameLocked(game);
    const finished = game.scoreA !== null && game.scoreB !== null;

    if (!locked && !finished) {
        alertBox.style.display = "flex";
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-muted)">Palpites ocultos até o início do jogo.</td></tr>`;
        modal.classList.add("active");
        return;
    }

    alertBox.style.display = "none";
    const gameBets = bets.filter(b => b.gameId === gameId);

    // Only show bets of participants who have paid/confirmed status
    const confirmedBets = gameBets.filter(bet => participantsPix[bet.participantName.trim().toUpperCase()] === true);

    if (confirmedBets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-muted)">Nenhum palpite confirmado para este jogo.</td></tr>`;
    } else {
        confirmedBets.forEach(bet => {
            let ptsText = "-";
            if (finished) {
                ptsText = `${calculatePoints(bet, game)} pts`;
            }
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${bet.participantName}</strong></td>
                <td><span style="font-family:var(--font-display); font-weight:700;">${bet.betScoreA} x ${bet.betScoreB}</span></td>
                <td>${ptsText}</td>
            `;
            tbody.appendChild(row);
        });
    }

    modal.classList.add("active");
};

// ==========================================
// PAGE BOOTSTRAP AND MAIN EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    setupMockDataIfEmpty();
    populateTeamSelects();

    // Render Initial UI elements
    renderGames();
    renderRanking();
    renderPixInfoPanel();

    // Fetch latest matches and ranking stats from Supabase
    loadDataFromDatabase();

    // Fill name, email and whatsapp inputs if user previously logged/purchased
    const nameInput = document.getElementById("checkoutName");
    const emailInput = document.getElementById("checkoutEmail");
    const whatsappInput = document.getElementById("checkoutWhatsapp");
    if (loggedUserName) nameInput.value = loggedUserName;
    if (loggedUserEmail) emailInput.value = loggedUserEmail;
    if (loggedUserWhatsapp) whatsappInput.value = loggedUserWhatsapp;

    // Load Admin variables on admin panel load
    document.getElementById("adminPriceInput").value = pricePerGame;
    document.getElementById("adminKeyInput").value = manualPixKey;
    document.getElementById("adminMpTokenInput").value = mpToken;

    // Secret backdoor to show Admin button
    const headerTitle = document.querySelector(".header-logo");
    let clickCount = 0;
    if (headerTitle) {
        headerTitle.addEventListener("click", () => {
            clickCount++;
            if (clickCount >= 5) {
                const openAdminBtn = document.getElementById("openAdminBtn");
                if (openAdminBtn) {
                    openAdminBtn.style.display = "inline-flex";
                    showToast("Painel Admin revelado!", "success");
                }
                clickCount = 0;
            }
        });
    }

    // Also support revealing via query parameter ?admin=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("admin") === "true") {
        const openAdminBtn = document.getElementById("openAdminBtn");
        if (openAdminBtn) {
            openAdminBtn.style.display = "inline-flex";
        }
    }

    // 1. Navigation Tab Switches
    const tabButtons = document.querySelectorAll(".nav-tab");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const panels = document.querySelectorAll(".tab-panel");
            panels.forEach(p => p.classList.remove("active"));
            
            document.getElementById(`panel-${targetTab}`).classList.add("active");
            activeTab = targetTab;

            if (targetTab === "ranking") {
                renderRanking();
            } else if (targetTab === "pagamento") {
                renderPixInfoPanel();
            } else {
                renderGames();
            }
        });
    });

    // 2. Games filter selection
    const filterButtons = document.querySelectorAll(".filter-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeFilter = btn.getAttribute("data-filter");
            renderGames();
        });
    });

    // 3. Admin Panel Modal toggle
    const openAdminBtn = document.getElementById("openAdminBtn");
    const closeAdminBtn = document.getElementById("closeAdminBtn");
    const adminModal = document.getElementById("adminModal");

    openAdminBtn.addEventListener("click", () => {
        if (isAdminLoggedIn) {
            document.getElementById("adminAuthArea").style.display = "none";
            document.getElementById("adminPanelArea").style.display = "block";
            renderAdminGames();
            renderAdminBets();
        } else {
            document.getElementById("adminAuthArea").style.display = "block";
            document.getElementById("adminPanelArea").style.display = "none";
        }
        adminModal.classList.add("active");
    });

    closeAdminBtn.addEventListener("click", () => {
        adminModal.classList.remove("active");
    });

    // Handle Admin Password login
    const loginAdminBtn = document.getElementById("loginAdminBtn");
    const adminPasswordInput = document.getElementById("adminPasswordInput");
    const authErrorMsg = document.getElementById("authErrorMsg");

    function processAdminLogin() {
        const pin = adminPasswordInput.value.trim();
        if (pin === DEFAULT_ADMIN_PIN) {
            isAdminLoggedIn = true;
            authErrorMsg.style.display = "none";
            document.getElementById("adminAuthArea").style.display = "none";
            document.getElementById("adminPanelArea").style.display = "block";
            adminPasswordInput.value = "";
            showToast("Login de administrador efetuado!", "success");
            renderAdminGames();
            renderAdminBets();
        } else {
            authErrorMsg.style.display = "block";
        }
    }

    loginAdminBtn.addEventListener("click", processAdminLogin);
    adminPasswordInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") processAdminLogin();
    });

    // Admin Tabs switching
    const adminTabButtons = document.querySelectorAll(".admin-tab-btn");
    adminTabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            adminTabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const adminSubPanels = document.querySelectorAll(".admin-sub-panel");
            adminSubPanels.forEach(p => p.classList.remove("active"));

            const targetAdminSub = btn.getAttribute("data-admin-tab");
            document.getElementById(`admin-${targetAdminSub}`).classList.add("active");

            if (targetAdminSub === "manage-bets") {
                renderAdminBets();
            } else if (targetAdminSub === "add-game") {
                renderAdminGames();
            }
        });
    });

    // 4. Create new game action
    const newGameForm = document.getElementById("newGameForm");
    newGameForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const teamA = document.getElementById("teamAName").value;
        const teamB = document.getElementById("teamBName").value;
        const dateTime = document.getElementById("gameDateTime").value;

        if (teamA === teamB) {
            showToast("Escolha dois times diferentes!", "error");
            return;
        }

        const newGameId = "game-" + Date.now();

        try {
            const response = await fetch(`${BACKEND_URL}/api/games`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": "admin123"
                },
                body: JSON.stringify({
                    id: newGameId,
                    team_a: teamA,
                    team_b: teamB,
                    date_time: dateTime
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erro ao salvar no servidor");
            }

            games.push({
                id: newGameId,
                teamA: teamA,
                teamB: teamB,
                dateTime: dateTime,
                scoreA: null,
                scoreB: null
            });

            showToast(`Jogo ${teamA} x ${teamB} cadastrado!`, "success");
            saveToLocalStorage();
            newGameForm.reset();
            
            renderAdminGames();
            renderGames();
        } catch (error) {
            console.error(error);
            showToast(`Falha ao cadastrar: ${error.message}`, "error");
        }
    });

    // 5. Save Admin / MP settings
    const savePixSettingsBtn = document.getElementById("savePixSettingsBtn");

    savePixSettingsBtn.addEventListener("click", () => {
        const newPrice = parseFloat(document.getElementById("adminPriceInput").value);
        const newKey = document.getElementById("adminKeyInput").value.trim();
        const newToken = document.getElementById("adminMpTokenInput").value.trim();

        if (isNaN(newPrice) || newPrice < 0) {
            showToast("Preço inválido.", "error");
            return;
        }

        if (newKey === "") {
            showToast("A chave PIX manual não pode estar vazia.", "error");
            return;
        }

        pricePerGame = newPrice;
        manualPixKey = newKey;
        if (newToken !== "") {
            mpToken = newToken;
        }

        saveToLocalStorage();
        showToast("Configurações salvas com sucesso!", "success");
        renderPixInfoPanel();
        updateCartBar();
    });

    checkoutBtn.addEventListener("click", () => {
        renderCheckoutSummary();
        showCheckoutStep("checkoutFormStep");
        checkoutModal.classList.add("active");
    });

    closeCheckoutBtn.addEventListener("click", () => {
        checkoutModal.classList.remove("active");
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
        }
    });

    generatePixBtn.addEventListener("click", async () => {
        const nameVal = document.getElementById("checkoutName").value.trim();
        const emailVal = document.getElementById("checkoutEmail").value.trim();
        const whatsappVal = document.getElementById("checkoutWhatsapp").value.trim();

        if (nameVal === "") {
            showToast("Por favor, preencha o seu nome.", "error");
            return;
        }

        if (whatsappVal === "") {
            showToast("Por favor, preencha o seu WhatsApp.", "error");
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailVal)) {
            showToast("Por favor, insira um e-mail válido.", "error");
            return;
        }

        // Calculate value
        const betCount = Object.keys(tempBets).length;
        const totalValue = betCount * pricePerGame;

        // Show polling screen with loader overlay active
        showCheckoutStep("checkoutPixStep");
        document.getElementById("checkoutQrLoading").style.display = "flex";

        try {
            // Call API
            const payment = await createMercadoPagoPixPayment(nameVal, emailVal, totalValue, whatsappVal);
            
            const qrBase64 = payment.point_of_interaction.transaction_data.qr_code_base64;
            const qrCopiaCola = payment.point_of_interaction.transaction_data.qr_code;
            const paymentId = payment.id;
            
            // Render details
            document.getElementById("checkoutQrImg").src = `data:image/png;base64,${qrBase64}`;
            document.getElementById("checkoutPixCopiar").value = qrCopiaCola;
            
            // Hide loading indicator
            document.getElementById("checkoutQrLoading").style.display = "none";
            
            // Start listening status
            startPaymentPolling(paymentId, nameVal, emailVal, whatsappVal);
            showToast("Código PIX gerado com sucesso!", "success");
            
            const simulateSuccessBtn = document.getElementById("simulateSuccessBtn");
            if (isSimulatorMode) {
                simulateSuccessBtn.style.display = "block";
            } else {
                simulateSuccessBtn.style.display = "none";
            }
            
        } catch (error) {
            console.error(error);
            showToast(`Erro ao gerar PIX: ${error.message}`, "error");
            // Revert back to details step
            showCheckoutStep("checkoutFormStep");
        }
    });

    // Copy checkout PIX key
    const copyCheckoutPixBtn = document.getElementById("copyCheckoutPixBtn");
    copyCheckoutPixBtn.addEventListener("click", () => {
        const checkoutPixCopiar = document.getElementById("checkoutPixCopiar");
        checkoutPixCopiar.select();
        checkoutPixCopiar.setSelectionRange(0, 99999);
        
        navigator.clipboard.writeText(checkoutPixCopiar.value)
            .then(() => {
                showToast("Código PIX Copia e Cola copiado!", "success");
            })
            .catch(() => {
                showToast("Erro ao copiar.", "error");
            });
    });

    // Close success step button
    const closeSuccessBtn = document.getElementById("closeSuccessBtn");
    closeSuccessBtn.addEventListener("click", () => {
        checkoutModal.classList.remove("active");
        // Open the classification tab
        document.querySelector('.nav-tab[data-tab="ranking"]').click();
    });



    // 7. Reset all database data
    const resetAllDataBtn = document.getElementById("resetAllDataBtn");
    resetAllDataBtn.addEventListener("click", () => {
        if (confirm("Isso apagará TODOS os dados. Deseja prosseguir?")) {
            localStorage.removeItem("bolao_games");
            localStorage.removeItem("bolao_bets");
            localStorage.removeItem("bolao_participants_pix");
            localStorage.removeItem("bolao_price_per_game");
            localStorage.removeItem("bolao_mp_token");
            localStorage.removeItem("bolao_manual_pix_key");
            localStorage.removeItem("bolao_user_name");
            localStorage.removeItem("bolao_user_email");
            
            games = [];
            bets = [];
            participantsPix = {};
            pricePerGame = 5.00;
            mpToken = DEFAULT_MP_TOKEN;
            manualPixKey = "financeiro@empresa.com";
            loggedUserName = "";
            loggedUserEmail = "";
            tempBets = {};
            isSimulatorMode = false;
            mockPaymentApproved = false;
            
            setupMockDataIfEmpty();
            renderGames();
            renderRanking();
            renderPixInfoPanel();
            updateCartBar();
            
            document.getElementById("adminPriceInput").value = pricePerGame;
            document.getElementById("adminKeyInput").value = manualPixKey;
            document.getElementById("adminMpTokenInput").value = mpToken;
            renderAdminGames();
            renderAdminBets();
            showToast("Banco de dados resetado!", "info");
        }
    });

    // 8. Close Detail/Admin Modals
    const closeBetsDetailBtn = document.getElementById("closeBetsDetailBtn");
    const betsDetailModal = document.getElementById("betsDetailModal");
    closeBetsDetailBtn.addEventListener("click", () => {
        betsDetailModal.classList.remove("active");
    });

    window.addEventListener("click", (e) => {
        if (e.target === adminModal) {
            adminModal.classList.remove("active");
        }
        if (e.target === betsDetailModal) {
            betsDetailModal.classList.remove("active");
        }
        if (e.target === checkoutModal) {
            // Prevent close on click outside if polling is active
            if (!pollingIntervalId) {
                checkoutModal.classList.remove("active");
            }
        }
    });

    // Check lock status periodically (every 5 seconds)
    setInterval(checkGameLockStatus, 5000);
});
