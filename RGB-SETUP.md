# ASGARD PC lighting

Live site: https://asgrard-backend.rayanfahil2.workers.dev/

SignalRGB Pro must be signed in and running on this PC. The Lian Li Uni Fan Controller uses Canvas lighting. No cooling or fan-speed commands are sent by this integration.

Thor uses blue (#47B3FF), Loki green (#1FB352), Odin gold (#DBA340); locked personas use red (#FF0B12). Other SignalRGB devices using Canvas also follow the effect. The physical fan model/count is not confirmed; the controller currently has default strip components.

The installed helper listens only on 127.0.0.1:18771. It permits the production ASGARD origin and requires a random local pairing key for state changes. It accepts only persona and lock state, never arbitrary device or shell commands. Settings → PC lights → Connect PC lights pairs another browser on this PC. Allow the browser's local-device connection prompt. Disconnect stops that browser's updates and retains the last color. Only the visible paired tab sends changes; close duplicate ASGARD tabs to avoid competing selections. Phones cannot control this PC through this local-only connection.

Installation: run `node scripts/install-rgb.mjs` using a stable installed Node runtime. This copies the helper to `%LOCALAPPDATA%\ASGARD-RGB`, installs four HTML effects in Documents\WhirlwindFX\Effects, and creates a hidden Windows sign-in startup entry. Restart SignalRGB after adding new effects. Restart the helper after updating its installed script. Keep pairing.json private; it is not part of the repository or deployment.

Verification completed: 120 unit checks; browser layout and persona regression checks; real SignalRGB readback for three personas and red lock; pairing, reload persistence and disconnect; production manifest with 177 matching assets. Physical LED output requires user observation.

Deployment: Worker version 35481d69-8a4b-4483-85e9-311165709317, release workspace-3fb0952e991d. Previous version 677fdd29-1c35-4a48-8a94-7a8622826a59 is the rollback target. Backend and secrets were preserved.
