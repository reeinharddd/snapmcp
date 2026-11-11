# Security Policy for snapmcp

## Scope and trust model

snapmcp is a local stdio MCP server that renders content into visual documentation artifacts. It may read explicitly allowed files, navigate public HTTP(S) URLs, render synthetic content in Chromium, and write generated files.

Treat all MCP inputs as untrusted:

- terminal, code, Markdown, HTML, and diff text may contain hostile markup;
- URLs may target internal services or change DNS answers between checks;
- file paths and output names may contain traversal or symlink tricks;
- browser profiles may contain credentials and authenticated state.

The controls below reduce common risks. They do not turn snapmcp into a complete isolation boundary for hostile websites or untrusted local code.

## Enforced controls

### URL and SSRF validation

URL-producing tools accept HTTP(S) only. Other URL schemes and URLs with embedded credentials are rejected.

`SNAPMCP_SSRF_PROTECTION` is enabled by default. With it enabled, snapmcp blocks:

- private, loopback, link-local, multicast, and reserved IPv4 ranges;
- loopback, unique-local, link-local, multicast, IPv4-mapped, and IPv4-compatible IPv6 addresses;
- localhost variants such as `localhost`, `*.localhost`, and trailing-dot forms;
- hostnames that resolve to private or local addresses.

The initial URL is checked, and browser requests are revalidated as they occur, including redirects and subresources. URL checks also apply to URL entries inside composite tools.

### Known SSRF limit: DNS is not pinned

Chromium resolves and connects to DNS independently. snapmcp does not pin Chromium to the IP address it validated, so it cannot guarantee complete prevention of DNS rebinding or a time-of-check/time-of-use DNS change.

For hostile targets, use an additional network boundary: a dedicated container or VM without access to internal networks, egress filtering, and dedicated browser credentials. Do not treat the default checks as sufficient isolation for arbitrary public sites.

`SNAPMCP_SSRF_PROTECTION=false` disables the SSRF checks. `SNAPMCP_SECURITY_CHECKS=false` disables the broader validation layer, including the file-read allowlist and additional byte/file-size checks; output confinement, HTTP(S)-only URL validation, and the separate SSRF setting remain in force. Neither switch should be used in a shared or hostile environment.

### File-read allowlist

`capture_file`, including `file` entries in composite tools, is deny-all until `SNAPMCP_ALLOWED_PATHS` is configured.

Allowed entries may be files or directories and may be separated with commas or semicolons. Paths are resolved before the boundary check, so a symlink inside an allowed directory cannot point to an unauthorized target. Reads are limited to regular files and to the configured maximum file size.

### Output confinement

Every generated file must remain inside `SNAPMCP_DIR`. This includes files produced by `capture_batch`, `capture_sequence`, `capture_gif`, and `capture_document`.

Filename traversal and symlink escapes are checked. Relative paths are resolved inside the output root; an absolute path is accepted only when it resolves inside that root. A requested output name is not an authorization to write elsewhere.

### Synthetic-content isolation

Synthetic captures, including terminal, code, diff, Markdown, HTML, and generated document PDFs, render in an isolated browser context with:

- JavaScript disabled;
- external network resources blocked;
- a restrictive Content Security Policy applied.

Markdown and HTML add content-specific handling: raw HTML embedded in Markdown is escaped, and raw HTML supplied to `capture_html` is DOM-sanitized, with scripts, frames, and embedded external content removed or blocked.

The sanitizer and browser policy are defense in depth. They are not a proof that every malformed or adversarial document is harmless. Keep the Chromium sandbox enabled and isolate hostile content.

### Bounded inputs and outputs

| Input | Limit |
|---|---:|
| Terminal lines | 1,000 lines |
| Terminal text | 1 MB |
| Code | 200 KB |
| Markdown | 200 KB |
| HTML | 200 KB |
| Diff | 500 KB |
| File read | 5 MB by default |
| Batch items | 10 |
| Sequence steps | 60 |
| GIF frames | 2 to 60 |
| GIF canvas | 8,192 by 8,192 pixels |
| Document captures | 30 |
| Embedded image | 25 MB each |
| Total embedded document images | 75 MB |

Capture/document tool responses return saved file paths rather than image bytes; `snapmcp-hint` returns text guidance.

### Browser profiles

`SNAPMCP_CHROME_PROFILE` launches Chromium with a persistent user-data directory. A detected profile key or display name, such as `Default` or `Profile 1`, selects the detected Chrome user-data directory and adds `--profile-directory=<key>`; an absolute path is used as the user-data directory directly. Profile mode requires a system Chrome installation. URL captures run in that persistent context, so cookies and session state from the selected profile can be sent to the target site. Synthetic captures remain isolated. Profile directories hold credentials and other sensitive state, so treat them as secrets.

Use a dedicated, least-privileged profile. Do not point snapmcp at a live personal profile unless the profile and browser data are intentionally isolated.

### Chromium sandbox

The server checks Chromium sandbox availability at startup and reports a warning when the sandbox is unavailable. A successful check is not a substitute for container, VM, or OS-level isolation.

## What is not guaranteed

- Complete DNS-rebinding prevention, because Chromium does not pin the validated DNS result.
- Perfect HTML or Markdown sanitization, including safety against novel parser or browser exploits.
- Safe reuse of an authenticated browser profile.
- Protection from a malicious local process with the same operating-system permissions as the server.
- A guarantee that arbitrary public sites are benign even when network targets pass the URL checks.

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability. Use GitHub's private vulnerability reporting feature for this repository or contact the maintainer through the repository's security contact.

Include:

- affected version and runtime;
- minimum reproduction steps;
- the expected and observed security boundary;
- whether the issue requires a local file, authenticated profile, hostile URL, or malicious synthetic content.

We will acknowledge a complete report and coordinate a fix and disclosure timeline.

## Supply-chain note

This policy does not claim npm provenance, a committed npm lockfile, or an `npm audit` gate. Use the repository's current lockfile, CI configuration, and published package attestations, when present, as the authoritative supply-chain signals.
