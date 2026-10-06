(() => {
  const piles = { things: THINGS, places: PLACES, actions: ACTIONS };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rand = (n) => {
    // Rejection sampling avoids modulo bias.
    const max = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  };

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // A pile deals every entry once, then reshuffles, like paper slips in a bowl.
  const bags = {};
  const deal = (name) => {
    if (!bags[name] || !bags[name].length) {
      const last = bags[name + "_last"];
      let fresh = shuffle(piles[name]);
      // Avoid the same slip twice in a row across a reshuffle.
      if (last && fresh[fresh.length - 1] === last && fresh.length > 1) fresh.unshift(fresh.pop());
      bags[name] = fresh;
    }
    const item = bags[name].pop();
    bags[name + "_last"] = item;
    return item;
  };

  const split = (entry) => {
    const i = entry.indexOf(" ");
    return { emoji: entry.slice(0, i), text: entry.slice(i + 1) };
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const cards = [...document.querySelectorAll(".card")];
  const drawBtn = $("#draw");

  const show = (card, entry) => {
    const { emoji, text } = split(entry);
    $(".emoji", card).textContent = emoji;
    $(".word", card).textContent = text;
  };
  const updateLeft = (card) => {
    const name = card.dataset.pile;
    $(".left", card).textContent = `${(bags[name] || []).length} left in pile`;
  };

  const spinCard = (card, ms) => new Promise((resolve) => {
    const name = card.dataset.pile;
    const final = deal(name);
    if (reduceMotion) { show(card, final); updateLeft(card); return resolve(final); }
    card.classList.add("spin");
    const t = setInterval(() => show(card, piles[name][rand(piles[name].length)]), 70);
    setTimeout(() => {
      clearInterval(t);
      card.classList.remove("spin");
      show(card, final);
      updateLeft(card);
      card.classList.remove("pop");
      void card.offsetWidth;
      card.classList.add("pop");
      resolve(final);
    }, ms);
  });

  const save = () => {
    try {
      sessionStorage.setItem("twd", JSON.stringify(cards.map((c) => [$(".emoji", c).textContent, $(".word", c).textContent])));
    } catch (e) { /* storage unavailable */ }
  };
  const restore = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("twd"));
      if (Array.isArray(saved) && saved.length === cards.length) {
        saved.forEach(([e, w], i) => { $(".emoji", cards[i]).textContent = e; $(".word", cards[i]).textContent = w; });
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  };

  // Timer
  const clock = $("#clock");
  const duration = $("#duration");
  let timerId = null;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const stopTimer = () => { clearInterval(timerId); timerId = null; };
  const startTimer = () => {
    stopTimer();
    let left = Number(duration.value);
    if (!left) { clock.hidden = true; return; }
    const end = Date.now() + left * 1000;
    clock.hidden = false;
    clock.classList.remove("low");
    clock.textContent = fmt(left);
    timerId = setInterval(() => {
      left = Math.max(0, Math.round((end - Date.now()) / 1000));
      clock.textContent = left === 0 ? "⏰ Pencils down!" : fmt(left);
      clock.classList.toggle("low", left <= 10 && left > 0);
      if (left === 0) stopTimer();
    }, 250);
  };
  duration.addEventListener("change", () => { stopTimer(); clock.hidden = true; });

  drawBtn.addEventListener("click", async () => {
    drawBtn.disabled = true;
    stopTimer();
    clock.hidden = true;
    // Stagger the stops so the cards settle one after another.
    await Promise.all(cards.map((c, i) => spinCard(c, 700 + i * 350)));
    save();
    drawBtn.disabled = false;
    drawBtn.textContent = "🎲 Draw again!";
    startTimer();
  });

  cards.forEach((card) => {
    $(".reroll", card).addEventListener("click", async (e) => {
      e.target.disabled = true;
      await spinCard(card, 600);
      e.target.disabled = false;
      save();
    });
  });

  if (restore()) drawBtn.textContent = "🎲 Draw again!";
  cards.forEach((c) => { const n = c.dataset.pile; $(".left", c).textContent = `${piles[n].length} in pile`; });
})();
