# Local research fixtures

`npm run fixtures:acquire` obtains a single small public `.ovmap` sample for clean-room compatibility testing and verifies its SHA-256 before use. The binary is gitignored because its source repository has no verified redistribution license and its embedded upstream configuration does not grant tile-use authorization.

These files are parser evidence only. Tests must not request any embedded host.
