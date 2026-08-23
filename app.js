(function () {
  "use strict";

  var API_URL = "https://jsonblob.iiif.arthistoricum.net/api/jsonBlob/0966ebae-9f17-11f1-bdf1-e16059762aba";
  var TOP_N = 10;

  var form = document.getElementById("add-form");
  var nameInput = document.getElementById("racer-name");
  var clockEl = document.getElementById("clock");
  var startBtn = document.getElementById("clock-start");
  var stopBtn = document.getElementById("clock-stop");
  var clockResetBtn = document.getElementById("clock-reset");
  var formError = document.getElementById("form-error");
  var emptyState = document.getElementById("empty-state");
  var podiumEl = document.getElementById("podium");
  var restList = document.getElementById("rest-list");
  var racerCount = document.getElementById("racer-count");
  var resetBtn = document.getElementById("reset-btn");
  var banner = document.getElementById("banner");
  var confetti = document.getElementById("confetti");
  var modal = document.getElementById("modal");
  var modalTitle = document.getElementById("modal-title");
  var modalMessage = document.getElementById("modal-message");
  var modalOk = document.getElementById("modal-ok");
  var modalCancel = document.getElementById("modal-cancel");

  var racers = [];
  var pendingAction = null;
  var lastFocus = null;
  var bannerTimer = null;
  var clockRunning = false;
  var clockStart = 0;
  var clockElapsed = 0;
  var clockRaf = 0;
  var wakeLock = null;

  function uid() {
    return "lap-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeRacers(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(function (row) {
        return row && typeof row.name === "string" && typeof row.time === "number" && isFinite(row.time) && row.time > 0;
      })
      .map(function (row) {
        return {
          id: typeof row.id === "string" ? row.id : uid(),
          name: row.name,
          time: row.time,
          createdAt: typeof row.createdAt === "number" ? row.createdAt : Date.now()
        };
      });
  }

  function loadRacers() {
    return fetch(API_URL, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("load failed");
        return res.json();
      })
      .then(function (data) {
        racers = normalizeRacers(data && data.racers);
        render();
      })
      .catch(function () {
        racers = [];
        render();
        showError("Could not load the board. Check the signal and try again.");
      });
  }

  function saveRacers() {
    return fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ racers: racers })
    }).then(function (res) {
      if (!res.ok) throw new Error("save failed");
    });
  }

  function formatTime(seconds) {
    return seconds.toFixed(2) + "s";
  }

  function clockSeconds() {
    var extra = clockRunning ? (performance.now() - clockStart) / 1000 : 0;
    return clockElapsed + extra;
  }

  function paintClock() {
    clockEl.textContent = formatTime(clockSeconds());
  }

  function tickClock() {
    paintClock();
    if (clockRunning) {
      clockRaf = requestAnimationFrame(tickClock);
    }
  }

  function setClockButtons() {
    startBtn.hidden = clockRunning;
    stopBtn.hidden = !clockRunning;
  }

  function startClock() {
    if (clockRunning) return;
    clearError();
    clockElapsed = 0;
    clockStart = performance.now();
    clockRunning = true;
    setClockButtons();
    clockEl.classList.add("running");
    tickClock();
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request("screen").then(function (lock) {
        wakeLock = lock;
      }).catch(function () {});
    }
  }

  function stopClock() {
    if (!clockRunning) return;
    clockElapsed += (performance.now() - clockStart) / 1000;
    clockRunning = false;
    if (clockRaf) cancelAnimationFrame(clockRaf);
    clockRaf = 0;
    setClockButtons();
    clockEl.classList.remove("running");
    paintClock();
    if (wakeLock) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }

  function resetClock() {
    clockRunning = false;
    clockStart = 0;
    clockElapsed = 0;
    if (clockRaf) cancelAnimationFrame(clockRaf);
    clockRaf = 0;
    setClockButtons();
    clockEl.classList.remove("running");
    paintClock();
    if (wakeLock) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }

  function nameKey(name) {
    return name.trim().toLowerCase();
  }

  function bestTimesByName(list) {
    var map = {};
    list.forEach(function (row) {
      var key = nameKey(row.name);
      if (map[key] === undefined || row.time < map[key]) {
        map[key] = row.time;
      }
    });
    return map;
  }

  function lapsByName(list) {
    var map = {};
    list.forEach(function (row) {
      var key = nameKey(row.name);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }

  function sortedRacers() {
    return racers.slice().sort(function (a, b) {
      if (a.time !== b.time) return a.time - b.time;
      return a.createdAt - b.createdAt;
    });
  }

  function currentLeaderTime() {
    if (!racers.length) return null;
    return sortedRacers()[0].time;
  }

  function showError(msg) {
    formError.hidden = false;
    formError.textContent = msg;
  }

  function clearError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  function pbBadge(row, bests, counts) {
    var key = nameKey(row.name);
    if (counts[key] > 1 && row.time === bests[key]) {
      return '<span class="pb" title="Personal best">PB</span>';
    }
    return "";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function deleteButton(id, name) {
    return (
      '<button type="button" class="icon-btn" data-delete="' +
      escapeHtml(id) +
      '" aria-label="Remove ' +
      escapeHtml(name) +
      ' from the board">✕</button>'
    );
  }

  function render() {
    var ranked = sortedRacers();
    var total = ranked.length;
    var top = ranked.slice(0, TOP_N);
    var bests = bestTimesByName(racers);
    var counts = lapsByName(racers);

    if (total > TOP_N) {
      racerCount.hidden = false;
      racerCount.textContent = total + " racers";
    } else {
      racerCount.hidden = true;
      racerCount.textContent = "";
    }

    if (total === 0) {
      emptyState.hidden = false;
      podiumEl.hidden = true;
      restList.hidden = true;
      podiumEl.innerHTML = "";
      restList.innerHTML = "";
      return;
    }

    emptyState.hidden = true;

    var medals = ["gold", "silver", "bronze"];
    var places = ["1st", "2nd", "3rd"];
    var podium = top.slice(0, 3);
    podiumEl.hidden = podium.length === 0;
    podiumEl.innerHTML = podium
      .map(function (row, i) {
        return (
          '<article class="pod-card ' +
          medals[i] +
          '">' +
          '<div class="row-actions">' +
          deleteButton(row.id, row.name) +
          "</div>" +
          '<div class="medal" aria-hidden="true">' +
          (i + 1) +
          "</div>" +
          '<p class="pod-place">' +
          places[i] +
          " place</p>" +
          '<p class="pod-name">' +
          escapeHtml(row.name) +
          pbBadge(row, bests, counts) +
          "</p>" +
          '<p class="pod-time">' +
          formatTime(row.time) +
          "</p>" +
          "</article>"
        );
      })
      .join("");

    var rest = top.slice(3);
    if (rest.length) {
      restList.hidden = false;
      restList.innerHTML = rest
        .map(function (row, i) {
          var rank = i + 4;
          return (
            '<li class="rest-row">' +
            '<span class="rank-badge">' +
            rank +
            "</span>" +
            '<span class="rest-name">' +
            escapeHtml(row.name) +
            pbBadge(row, bests, counts) +
            "</span>" +
            '<span class="rest-time">' +
            formatTime(row.time) +
            "</span>" +
            deleteButton(row.id, row.name) +
            "</li>"
          );
        })
        .join("");
    } else {
      restList.hidden = true;
      restList.innerHTML = "";
    }
  }

  function celebrate() {
    banner.hidden = false;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");

    if (bannerTimer) window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(function () {
      banner.classList.remove("show");
      banner.hidden = true;
    }, 2900);

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    confetti.innerHTML = "";
    var colors = ["#ffe14a", "#ff2e8a", "#3dbbff", "#3bc45a", "#ffffff", "#ff8a00"];
    var n = 36;
    for (var i = 0; i < n; i++) {
      var bit = document.createElement("i");
      bit.style.left = Math.random() * 100 + "%";
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = (Math.random() * 0.25).toFixed(2) + "s";
      bit.style.transform = "rotate(" + Math.floor(Math.random() * 360) + "deg)";
      confetti.appendChild(bit);
    }
    window.setTimeout(function () {
      confetti.innerHTML = "";
    }, 1800);
  }

  function closeModal() {
    modal.hidden = true;
    pendingAction = null;
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function openModal(opts) {
    lastFocus = document.activeElement;
    modalTitle.textContent = opts.title;
    modalMessage.textContent = opts.message;
    modalOk.textContent = opts.okLabel;
    modalCancel.textContent = opts.cancelLabel;
    pendingAction = opts.onConfirm;
    modal.hidden = false;
    modalOk.focus();
  }

  function askDelete(id) {
    var row = racers.find(function (r) { return r.id === id; });
    if (!row) return;
    openModal({
      title: "Are you sure?",
      message: "Take " + row.name + " (" + formatTime(row.time) + ") off the board?",
      okLabel: "Yes, take them off",
      cancelLabel: "Keep them",
      onConfirm: function () {
        var previous = racers;
        racers = racers.filter(function (r) { return r.id !== id; });
        render();
        saveRacers().catch(function () {
          racers = previous;
          render();
          showError("Could not save. That racer is still on the board.");
        });
      }
    });
  }

  function askReset() {
    openModal({
      title: "Start over?",
      message: "Wipe every time off the board?",
      okLabel: "Yes, reset",
      cancelLabel: "Keep racing",
      onConfirm: function () {
        var previous = racers;
        racers = [];
        render();
        saveRacers().catch(function () {
          racers = previous;
          render();
          showError("Could not reset. Times are still on the board.");
        });
      }
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearError();

    var name = nameInput.value.trim();
    if (clockRunning) stopClock();
    var time = clockElapsed;

    if (!name) {
      showError("Who ran? Type a name first.");
      nameInput.focus();
      return;
    }
    if (!(time > 0)) {
      showError("Hit GO, then STOP when they finish.");
      startBtn.focus();
      return;
    }

    var leader = currentLeaderTime();
    var isNewRecord = leader === null || time < leader;

    var entry = {
      id: uid(),
      name: name,
      time: time,
      createdAt: Date.now()
    };
    racers.push(entry);
    render();

    resetClock();
    nameInput.value = "";
    nameInput.focus();

    saveRacers()
      .then(function () {
        if (isNewRecord) celebrate();
      })
      .catch(function () {
        racers = racers.filter(function (r) { return r.id !== entry.id; });
        render();
        showError("Could not save that lap. Try again.");
      });
  });

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-delete]");
    if (btn) {
      askDelete(btn.getAttribute("data-delete"));
    }
  });

  startBtn.addEventListener("click", startClock);
  stopBtn.addEventListener("click", stopClock);
  clockResetBtn.addEventListener("click", function () {
    resetClock();
    clearError();
  });

  resetBtn.addEventListener("click", askReset);

  modalOk.addEventListener("click", function () {
    var action = pendingAction;
    closeModal();
    if (typeof action === "function") action();
  });

  modalCancel.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target.hasAttribute("data-modal-cancel")) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  loadRacers();
})();
