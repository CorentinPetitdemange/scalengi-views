# Scalengi Views — demo environment

The Codespace downloads the official demo image and starts it in a persistent Docker container. A local build is used as a fallback if the image is temporarily unavailable. The script waits for the health check to confirm a valid HTML page before reporting that the application is ready. Port **3000** should then open in a new tab.

## Test the application

- No account or password is required.
- Sample views and datasets are created locally in the browser.
- Imported Excel files remain in this browser's local storage.
- The initial installation and build usually take a few minutes; subsequent restarts are faster.

If the tab does not open automatically, open the **Ports** panel in VS Code and click the globe icon for port `3000`.

## Useful commands

```bash
# Follow the container logs
docker compose -f .devcontainer/compose.yaml logs -f

# Restart the application
docker compose -f .devcontainer/compose.yaml restart

# View its status and health check
docker compose -f .devcontainer/compose.yaml ps

# Check the project
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```
