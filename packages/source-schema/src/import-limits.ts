export const OVMAP_FILE_MAX_BYTES = 1024 * 1024;

export const OVMAP_BASE64_MAX_CHARS = 4 * Math.ceil(OVMAP_FILE_MAX_BYTES / 3);

// The API sends a JSON envelope rather than a raw file. Keep a small, explicit
// allowance for property names and compatible clients that still send a short
// filename, while the decoded file limit remains exact.
export const OVMAP_JSON_ENVELOPE_MAX_BYTES = 4 * 1024;

export const OVMAP_INSPECT_BODY_MAX_BYTES = OVMAP_BASE64_MAX_CHARS + OVMAP_JSON_ENVELOPE_MAX_BYTES;
