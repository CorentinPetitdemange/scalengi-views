# Scalengi Views — demo environment

The Codespace installs the pinned Node.js and pnpm versions, restores the project dependencies, then starts the development server directly in the workspace. The startup script waits for a valid HTTP response before reporting that the application is ready. Port **3000** should then open in a new tab.

## Test the application

- The demonstration administrator is `admin@scalengi.demo`.
- Read its generated password with `cat data/demo-admin-password` in the terminal.
- The password is generated once with restricted file permissions; it is never committed or printed in logs.
- Sample views and datasets are created once, locally in the browser, after this account signs in.
- Imported Excel files remain in this browser's local storage.
- The initial installation and build usually take a few minutes; subsequent restarts are faster.

If the tab does not open automatically, open the **Ports** panel in VS Code and click the globe icon for port `3000`.

## Useful commands

```bash
# Follow the development server logs
tail -f /tmp/scalengi-views-dev.log

# Restart the application
bash .devcontainer/start-demo.sh

# Check the application health
node -e "fetch('http://127.0.0.1:3000/').then(r => console.log(r.status))"

# Check the project
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```
