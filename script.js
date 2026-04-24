const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let state = {};
let multiSelectMode = false;
let selectedRank = null;

// --- INITIALISERING ---

function cardValue(rank) {
    if (rank === '2') return 2;
    if (rank === 'A') return 14;
    if (['J', 'Q', 'K'].includes(rank)) return { J: 11, Q: 12, K: 13 }[rank];
    return parseInt(rank);
}

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank, value: cardValue(rank) });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

function dealCards() {
    const deck = createDeck();
    state = {
        deck,
        pile: [],
        current: null,
        turn: 'player',
        player: { hand: [], up: [], down: [] },
        bot: { hand: [], up: [], down: [] }
    };

    ['player', 'bot'].forEach(name => {
        state[name].down = deck.splice(0, 3);
        state[name].up = deck.splice(0, 3);
        state[name].hand = deck.splice(0, 3);
    });

    render();
}

// --- SPILL-LOGIKK ---

function canPlay(card) {
    if (!state.current) return true;
    if (card.rank === '2' || card.rank === '10') return true;
    return card.value >= state.current.value;
}

function playCard(owner, source, index) {
    const player = state[owner];
    const card = player[source].splice(index, 1)[0];
    
    if (source === 'down' && !canPlay(card)) {
        state.pile.push(card);
        pickup(owner);
        return;
    }
    
    state.pile.push(card);

    if (card.rank === '10') {
        state.pile = [];
        state.current = null;
    } else if (card.rank === '2') {
        state.current = null;
    } else {
        state.current = card;
    }

    refillHand(player);
    if (checkWin(owner)) return;

    // Sjekk "Gris"-regel (4 like på rad i bunken)
    checkFourOfAKind();

    if (card.rank !== '10' && state.pile.length > 0) {
        state.turn = owner === 'player' ? 'bot' : 'player';
    } else if (state.pile.length === 0) {
        // Hvis 10-er eller 4 like tømte bunken, får man legge på nytt
        state.turn = owner;
    }

    render();
    if (state.turn === 'bot') setTimeout(botTurn, 800);
}

function playMultiple(rank) {
    const player = state.player;
    const cardsToPlay = player.hand.filter(c => c.rank === rank);
    const numToPlay = cardsToPlay.length;

    for (let i = 0; i < numToPlay - 1; i++) {
        const idx = player.hand.findIndex(c => c.rank === rank);
        const card = player.hand.splice(idx, 1)[0];
        state.pile.push(card);
    }

    const lastIdx = player.hand.findIndex(c => c.rank === rank);
    cancelMulti();
    playCard('player', 'hand', lastIdx);
}

function checkFourOfAKind() {
    if (state.pile.length >= 4) {
        const lastFour = state.pile.slice(-4);
        if (lastFour.every(c => c.rank === lastFour[0].rank)) {
            state.pile = [];
            state.current = null;
        }
    }
}

function pickup(owner) {
    const player = state[owner];
    player.hand.push(...state.pile);
    state.pile = [];
    state.current = null;
    state.turn = owner === 'player' ? 'bot' : 'player';
    render();
    if (state.turn === 'bot') setTimeout(botTurn, 800);
}

function refillHand(player) {
    while (player.hand.length < 3 && state.deck.length) {
        player.hand.push(state.deck.pop());
    }
}

// --- BOT-LOGIKK ---

function botTurn() {
    const bot = state.bot;
    const { source, cards } = availableCards(bot);
    const playable = cards.map((c, i) => ({ c, i })).filter(x => canPlay(x.c));

    if (!playable.length) {
        pickup('bot');
        return;
    }

    // Boten er smart nok til å legge alle like hvis den kan
    const move = playable[0]; 
    playCard('bot', source, move.i);
}

function availableCards(player) {
    if (player.hand.length) return { source: 'hand', cards: player.hand };
    if (player.up.length) return { source: 'up', cards: player.up };
    return { source: 'down', cards: player.down };
}

// --- UI & RENDER ---

function createCard(card, hidden = false, onClick = null) {
    const div = document.createElement('div');
    div.className = 'card' + (hidden ? ' back' : '') + (!hidden && ['♥', '♦'].includes(card.suit) ? ' red' : '');
    if (!hidden) div.textContent = `${card.rank}${card.suit}`;
    if (onClick) div.onclick = (e) => { e.stopPropagation(); onClick(); };
    return div;
}

function renderPlayer(area, player, isHuman) {
    area.innerHTML = '';
    const groups = isHuman ? getCardGroups(player.hand) : [];

    const tableDiv = document.createElement('div');
    tableDiv.className = 'table-cards';
    
    for (let i = 0; i < 3; i++) {
        const stack = document.createElement('div');
        stack.className = 'card-stack';

        if (player.down[i]) {
            const isSelectable = isHuman && state.turn === 'player' && player.hand.length === 0 && player.up.length === 0;
            stack.appendChild(createCard(player.down[i], true, isSelectable ? () => playCard('player', 'down', i) : null)); 
        }

        if (player.up[i]) {
            const isSelectable = isHuman && state.turn === 'player' && player.hand.length === 0;
            const upCard = createCard(player.up[i], false, isSelectable ? () => playCard('player', 'up', i) : null);
            upCard.classList.add('up');
            stack.appendChild(upCard);
        }
        tableDiv.appendChild(stack);
    }

    const handDiv = document.createElement('div');
    handDiv.className = 'hand-container';
    handDiv.innerHTML = `<h4>${isHuman ? 'DIN HÅND' : 'MOTSTANDER'}</h4>`;
    const handRow = document.createElement('div');
    handRow.className = 'card-row';
    
    player.hand.forEach((card, i) => {
        const cardEl = createCard(card, !isHuman);
        if (isHuman && groups.includes(card.rank)) cardEl.classList.add(`group-0`);

        if (isHuman && state.turn === 'player') {
            cardEl.onclick = (e) => {
              e.stopPropagation();

              // Hvis vi er i flervalg-modus (knappen er synlig)
              if (multiSelectMode && card.rank === selectedRank) {
                  // Her er den viktige endringen:
                  // Vi legger kun kortet vi trykket på, med mindre man trykker på den faktiske knappen.
                  playCard('player', 'hand', i);
                  cancelMulti();
              } 
              // Hvis kortet har par/flere like, men knappen ikke er vist ennå
              else if (groups.includes(card.rank)) {
                  showMultiOption(card.rank);
              } 
              // Standard spill
              else if (canPlay(card)) {
                  playCard('player', 'hand', i);
                  cancelMulti();
              }
          };
        }
        handRow.appendChild(cardEl);
    });
    handDiv.appendChild(handRow);
    
    if (isHuman) { area.append(tableDiv, handDiv); } 
    else { area.append(handDiv, tableDiv); }
}

function render() {
    const statusEl = document.getElementById('status');
    statusEl.textContent = state.turn === 'player' ? '🔥 DIN TUR! 🔥' : '🤖 BOTEN TENKER...';
    statusEl.className = state.turn === 'player' ? 'status-player' : 'status-bot';

    renderPlayer(document.getElementById('bot-area'), state.bot, false);
    renderPlayer(document.getElementById('player-area'), state.player, true);

    const discard = document.getElementById('discard-pile');
    discard.innerHTML = '';
    if (state.pile.length) discard.appendChild(createCard(state.pile[state.pile.length - 1]));

    updatePickupButton();
}

// --- HJELPEFUNKSJONER ---

function getCardGroups(cards) {
    const counts = {};
    cards.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
    return Object.keys(counts).filter(rank => counts[rank] > 1);
}

function showMultiOption(rank) {
    multiSelectMode = true;
    selectedRank = rank;
    const container = document.getElementById('multi-actions');
    container.style.display = 'flex';
    document.getElementById('confirmBtn').textContent = `LEGG ALLE ${rank}`;
}

function cancelMulti() {
    multiSelectMode = false;
    selectedRank = null;
    document.getElementById('multi-actions').style.display = 'none';
}

function updatePickupButton() {
    const btn = document.getElementById('pickupBtn');
    const locked = state.turn === 'player' && !playerHasValidMove();
    btn.className = locked ? 'must-pickup' : '';
    btn.textContent = locked ? "MÅ TA INN BUNKEN" : "Ta inn bunke";
}

function playerHasValidMove() {
    const { source, cards } = availableCards(state.player);
    return source === 'down' ? true : cards.some(card => canPlay(card));
}

function checkWin(owner) {
    const p = state[owner];
    if (!p.hand.length && !p.up.length && !p.down.length) {
        alert(owner === 'player' ? 'Du vant!' : 'Boten vant!');
        location.reload();
        return true;
    }
    return false;
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmBtn').onclick = (e) => {
        e.stopPropagation();
        if (selectedRank) playMultiple(selectedRank);
    };
    document.getElementById('cancelBtn').onclick = (e) => {
        e.stopPropagation();
        cancelMulti();
    };
    document.addEventListener('click', cancelMulti);
});

document.getElementById('startBtn').onclick = () => {
    document.getElementById('menu').classList.remove('active');
    document.getElementById('game').classList.add('active');
    dealCards();
};

document.getElementById('pickupBtn').onclick = (e) => {
    e.stopPropagation();
    if (state.turn === 'player') pickup('player');
};