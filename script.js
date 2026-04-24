const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let state = {};

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

function canPlay(card) {
  if (!state.current) return true;
  return card.rank === '2' || card.rank === '10' || card.value >= state.current.value;
}

function refillHand(player) {
  while (player.hand.length < 3 && state.deck.length) {
    player.hand.push(state.deck.pop());
  }
}

function playCard(owner, source, index) {
  const player = state[owner];
  const card = player[source].splice(index, 1)[0];
  state.pile.push(card);

  if (card.rank !== '2' && card.rank !== '10') {
    state.current = card;
  }

  if (card.rank === '2') state.current = null;
  if (card.rank === '10') {
    state.pile = [];
    state.current = null;
  }

  refillHand(player);

  if (checkWin(owner)) return;

  if (card.rank !== '10') {
    state.turn = owner === 'player' ? 'bot' : 'player';
  }

  render();
  if (state.turn === 'bot') setTimeout(botTurn, 800);
}

function availableCards(player) {
  if (player.hand.length) return { source: 'hand', cards: player.hand };
  if (player.up.length) return { source: 'up', cards: player.up };
  return { source: 'down', cards: player.down };
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

function botTurn() {
  const bot = state.bot;
  const { source, cards } = availableCards(bot);
  const playable = cards.map((c, i) => ({ c, i })).filter(x => canPlay(x.c));

  if (!playable.length) {
    pickup('bot');
    return;
  }

  const move = playable[Math.floor(Math.random() * playable.length)];
  playCard('bot', source, move.i);
}

function checkWin(owner) {
  const p = state[owner];
  if (!p.hand.length && !p.up.length && !p.down.length) {
    showVictory(owner === 'player' ? 'Du vant!' : 'Boten vant!');
    return true;
  }
  return false;
}

function showVictory(text) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('victory').classList.add('active');
  document.getElementById('victoryText').textContent = text;
}

function createCard(card, hidden = false, onClick = null) {
  const div = document.createElement('div');
  div.className = 'card' + (hidden ? ' back' : '') + (!hidden && ['♥', '♦'].includes(card.suit) ? ' red' : '');
  if (!hidden) div.textContent = `${card.rank}${card.suit}`;
  if (onClick) div.onclick = onClick;
  return div;
}

function renderPlayer(area, player, isHuman) {
  area.innerHTML = '';

  // 1. Lag bord-området (Down og Up kort)
  const tableDiv = document.createElement('div');
  tableDiv.className = 'table-cards';
  
  for (let i = 0; i < 3; i++) {
    const stack = document.createElement('div');
    stack.className = 'card-stack';

    // Legg til "Down"-kortet hvis det finnes
    if (player.down[i]) {
      stack.appendChild(createCard(player.down[i], true)); 
    }

    // Legg til "Up"-kortet oppå hvis det finnes
    if (player.up[i]) {
      const active = availableCards(player).source === 'up';
      const clickable = isHuman && state.turn === 'player' && active;
      const upCard = createCard(player.up[i], false, clickable ? () => playCard('player', 'up', i) : null);
      upCard.classList.add('up');
      stack.appendChild(upCard);
    }
    tableDiv.appendChild(stack);
  }

  // 2. Lag hånd-området (Tydelig markert)
  const handDiv = document.createElement('div');
  handDiv.className = 'hand-container';
  handDiv.innerHTML = `<h4>${isHuman ? 'Din hånd' : 'Motstanderens hånd'}</h4>`;
  
  const handRow = document.createElement('div');
  handRow.className = 'card-row';
  
  player.hand.forEach((card, i) => {
    const active = availableCards(player).source === 'hand';
    const clickable = isHuman && state.turn === 'player' && active;
    handRow.appendChild(createCard(card, !isHuman, clickable ? () => {
      if (canPlay(card)) playCard('player', 'hand', i);
    } : null));
  });

  handDiv.appendChild(handRow);

  // Rekkefølge: Motstander har bordet øverst, du har hånden nederst
  if (isHuman) {
    area.appendChild(tableDiv);
    area.appendChild(handDiv);
  } else {
    area.appendChild(handDiv);
    area.appendChild(tableDiv);
  }
}

function render() {
  document.getElementById('status').textContent = state.turn === 'player' ? 'Din tur' : 'Botens tur';
  
  renderPlayer(document.getElementById('bot-area'), state.bot, false);
  renderPlayer(document.getElementById('player-area'), state.player, true);

  const discard = document.getElementById('discard-pile');
  discard.innerHTML = '';
  if (state.pile.length) {
    discard.appendChild(createCard(state.pile[state.pile.length - 1]));
  }

  // Oppdater knappen basert på situasjonen
  updatePickupButton();
}

document.getElementById('startBtn').onclick = () => {
  document.getElementById('menu').classList.remove('active');
  document.getElementById('game').classList.add('active');
  dealCards();
};

document.getElementById('menuBtn').onclick = () => location.reload();
document.getElementById('restartBtn').onclick = () => location.reload();
document.getElementById('victoryMenuBtn').onclick = () => location.reload();
document.getElementById('pickupBtn').onclick = () => {
  if (state.turn !== 'player') return;

  const mustPickup = !playerHasValidMove();
  
  // Tillat alltid inntrekk hvis man må, 
  // ellers gjelder 3-kort-regelen for vanlig trekking fra dekk.
  if (mustPickup || state.player.hand.length < 3) {
    pickup('player');
  } else {
    alert("Du kan ikke trekke flere kort nå.");
  }
};

function playerHasValidMove() {
  const { source, cards } = availableCards(state.player);
  // I 'down'-fasen vet vi ikke verdien, så man må få lov til å prøve (og feile)
  if (source === 'down') return true; 
  
  return cards.some(card => canPlay(card));
}

function updatePickupButton() {
  const btn = document.getElementById('pickupBtn');
  if (state.turn === 'player' && !playerHasValidMove()) {
    btn.classList.add('must-pickup');
    btn.textContent = "MÅ TA INN BUNKEN";
  } else {
    btn.classList.remove('must-pickup');
    btn.textContent = "Ta inn bunke";
  }
}