# `.ovmap` `record37-zlib` compatibility

The first clean-room decoder supports one evidence-backed family only:

- bytes `0..3`: `OviO` magic;
- little-endian file length at offset 4 and uncompressed length at offset 8;
- zlib stream begins at offset 24;
- every record occupies `little-endian(record offset 0) + 8` bytes;
- map ID is at record offset 24 and maximum zoom at offset 32;
- four bounded UTF-8 strings begin at record offset 128: name, host, path template, and group.

Input, output, compression ratio, record count, record length, string length, and UTF-8 are bounded. Unknown headers and other container families fail closed. Projection/image codes remain unverified and are not guessed.

Local compatibility uses SHA-256 `a3de20dd1830e81697950bc13d93dba0d67dfc7d2f91651a86c79f04db750128`, a 455-byte public five-layer sample. Its source repository has no verified redistribution license, so the sample remains untracked. Its embedded URLs do not grant authorization to use or redistribute tiles; the test performs no upstream request.
