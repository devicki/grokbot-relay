# Grok Bot HTTP spike

This project is an offline experiment. It checks whether Cursor's Grok Bot session routes still answer, and whether a small client can parse a session response.

When asked if the routes still exist, call `routes`. When asked to test the client, call `self-check`.

Do not call `open-session`. That tool get-or-creates a bot on the signed-in account, and a new name creates an empty bot.
