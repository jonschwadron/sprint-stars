# SPRINT STARS — Lap Race Scoreboard

Kid-friendly backyard lap-race board. Live at https://jonschwadron.github.io/sprint-stars/

## How to use it

1. Type a name in **Who ran?**
2. Tap **GO!** when they take off.
3. Tap **STOP** when they finish.
4. Tap **Add to the board!**

Lowest seconds wins. Top 10 fastest laps. Scores are saved on a shared backend, so every phone sees the same board.

**Reset** on the clock clears a false start. **Reset board** in the footer wipes every time.

## Backend

Scores live at a shared JSON store (GET/PUT). See `backend/`.
