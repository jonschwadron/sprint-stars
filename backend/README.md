# Sprint Stars score backend

Production scores are a JSON document:

```json
{ "racers": [ { "id": "lap-…", "name": "Ada", "time": 6.12, "createdAt": 1710000000000 } ] }
```

- `GET` reads the board
- `PUT` replaces the whole `racers` list

The live site talks to that store so every phone shares one top 10.

`server.py` is a local copy of the same idea (optional, for tinkering on a computer).
