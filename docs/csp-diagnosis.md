# CSP failure and repair

The original export was served unchanged under a real HTTP `Content-Security-Policy` header containing `script-src 'self'`. Chromium reproduced the reported `EvalError`, and `document.querySelector('#root').textContent` was empty. This was a module-initialization failure, before React's first render.

## Exact origin

- Dependency: **ajv 8.20.0**, as resolved in the existing `package-lock.json` (the manifest range is `^8.17.1`).
- Entry: the previous `src/integration/core.ts` imported `ajv/dist/2020.js` and `ajv-formats`, instantiated Ajv at module scope and called `ajv.compile(schema)` there.
- Dependency source: `ajv/lib/compile/index.ts:171`, function `compileSchema`; distributed equivalent `ajv/dist/compile/index.js:89`. It creates `makeValidate` with the `Function` constructor. Meta-schema compilation can also reach this path.
- Failing original production location: **`dist/assets/index-CsNp8EDF.js:203:27558`**, minified function `g`.
- The original module-scope `md.compile(i3)` call appears at `dist/assets/index-CsNp8EDF.js:206:51449`.

Captured stack (request origin removed; bundle coordinates retained):

```text
EvalError: Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'self'.
    at new Function (<anonymous>)
    at g (assets/index-CsNp8EDF.js:203:27558)
    at g.O (assets/index-CsNp8EDF.js:203:28736)
    at g.N (assets/index-CsNp8EDF.js:203:28616)
    at Object.code (assets/index-CsNp8EDF.js:203:62258)
    at k (assets/index-CsNp8EDF.js:203:24150)
```

The full captured error and empty-root observation are retained in [`artifacts/csp-original-error.json`](../artifacts/csp-original-error.json). The old broken bundle is intentionally replaced, not shipped alongside the repaired assets.

## Root-cause repair

`scripts/generate-core-validator.mjs` now runs Ajv's [standalone generator](https://ajv.js.org/standalone.html) in Node before Vite transforms the application. Its output is ordinary ESM in `src/integration/core-validator.generated.mjs`. Small static string-length/decimal-format helpers are bundled into that generated file. No schema compiler, interpreter, code-string execution, remote script or browser shim is needed at runtime. The generated header records the input schema SHA-256. The included Ajv helper’s MIT notice is retained in `docs/ajv-LICENSE.txt`.

`src/integration/core.ts` imports this function instead of Ajv. The official schema and deployment JSON are unchanged. Decimal-format definitions are shared between generation and parity tests. The semantic identity, accounting, freshness, backoff, ETag and permanent-unlock logic is unchanged; the game engine, art and existing interface are unchanged.

The Vite plugin regenerates the module for development/production and rejects a browser graph containing Ajv's compiler. It parses every emitted JS chunk and rejects direct/member `eval`/`Function` execution and string timers. `node scripts/check-csp.mjs dist` repeats the AST audit independently. This static check detects known executable forms; the enforced-CSP browser walk additionally tests actual execution of the primary paths. No static scanner proves arbitrary reflective code safe.

The package manifest/lockfile were retained as required. Ajv remains installed for build generation and the existing Node verification command, but its compiler is absent from the application graph. No `unsafe-eval` permission, production CSP override, TLS bypass or hidden error suppression was added. The verification server's CSP is a test header only, not a change to hosting.

## Recovery and validation

`src/GameErrorBoundary.tsx` catches React rendering/effect errors and offers a focused heading, alert text and Reload game. `src/main.tsx` installs uncaught-error/rejection handlers before dynamically importing App, so app-module failures can be recovered too. `index.html` has visible static startup/reload content if the bootstrap itself cannot execute. Recovery does not reset, delete or replace browser saves, and errors are still reported to Console.

The final production export was exercised at a nested static path with `script-src 'self'`. A separate negative control loaded a real external page script that attempted Function construction and received `EvalError`, proving that evaluation was blocked during the test. That probe is served only by the test harness and is absent from `dist/`.

The main gameplay walk had zero page errors, console errors or CSP violations. All five screens, timers, dispatch/collection, saves and recovery were checked; full results and transport/deployment limits are in [`VALIDATION.md`](../VALIDATION.md). Public publication is a subsequent network step, so this report does not claim the new ENS deployment has already been validated.
