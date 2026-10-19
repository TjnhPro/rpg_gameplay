# `rpg_core` integration — L1 dependency

Source repository: https://github.com/TjnhPro/rpg_core

**Only allowed production import:**

```ts
import { calculateStats, calculateDamageB0 } from '@rpg/core/kernel';
```

Never import `@rpg/core`, `@rpg/core/skills`, `@rpg/core/combat`, `@rpg/core/effects`, `@rpg/core/spatial` or its source/deep/dist internals. Legacy is intentionally outside this repo's foundation.

## This ZIP intentionally does not preinstall Core

`rpg_core` is currently a private package intended for controlled `npm pack` / installed-consumer use. It isn't assumed available on the npm public registry. To add actual gameplay functions:

1. Decide/pin exact accepted `rpg_core` revision/artifact as part of the approved task (not floating branch or version label alone).
2. Build/pack the checked-out Core and install the archive into this repo, or use another approved reproducible artifact method.
3. Record reference and checksum in task evidence; ensure CI can access the exact dependency without machine-specific file paths.
4. Run strict TS typecheck and tests against **installed public** `@rpg/core/kernel`, not cloned source imports.
5. If a numerical capability is missing, report `CORE_CAPABILITY_GAP` with minimal reproduction, expected behavior, alternatives and STOP; no Core mutation inside L2 task.

Sample local Core build commands (when Node/npm available):

```sh
cd /path/to/rpg_core
npm ci --ignore-scripts
npm pack
```

Use the actual generated `.tgz` path; no generated tarball name or SHA is predetermined here. Do **not** commit a local absolute `file:` dependency that CI cannot install.
