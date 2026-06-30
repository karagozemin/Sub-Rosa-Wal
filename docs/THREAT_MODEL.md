# Sub Rosa — Threat Model

## Assets

| Asset | Location | Sensitivity |
| --- | --- | --- |
| Bid value | Ciphertext (temporary storage) until R | High — market impact if early |
| Bid commitment H | On-chain persistent | Medium — binding once committed |
| Escrow | On-chain persistent | High — funds at stake |
| Bidder identity | Auditor blob (temporary) | Medium — selective disclosure |
| Drand round R | Round record | Public — coordination clock |
| Encrypted metadata payload | Walrus blob | Medium — heavy context/evidence remains encrypted |
| Storage reference | Soroban persistent storage | Medium — binds round to external encrypted payload |
| Bosphor intent | EVM chain + Bosphor route | Medium — storage availability/reference |
| GOAT agent decision | Appraisal API response / optional Walrus artifact | Medium — strategy and rationale can influence bids |
| x402 payment authorization | HTTP header + facilitator settlement | High — spend authorization |
| Session mandate | Off-chain agent | Medium — caps delegation |
| Principal key | Off-chain | Critical — not used on-chain in agent flow |

## Adversaries

1. **Operator** — wants to learn bids early or bias clearing
2. **Competing bidder** — wants rival bids before R
3. **Keeper** — could censor reveals (liveness, not secrecy after R)
4. **Appraisal server** — could overcharge or return biased valuations
5. **GOAT agent adapter / model** — could return bad strategy or claim live mode incorrectly
6. **Malicious agent** — tries to exceed mandate caps
7. **Auditor** — learns identities; must not learn bids before R if honest protocol followed
8. **Storage route failure** — Walrus/Bosphor unavailable or wrong blob reference returned
9. **Wallet route confusion** — user signs with a wallet that cannot perform the intended layer's action

## Protections

### Early bid disclosure (operator / competitor)

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Read ciphertext before R | tlock IBE — needs Drand round-R sig | None if Drand honest |
| Operator skips reveal | Permissionless `open_reveal` + keeper | Liveness relies on someone running keeper |
| Selective reveal one bid | Contract allows reveal-all; keeper reveals every seal | Keeper could delay but not permanently hide after R |

### Binding and fairness

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Bid change after commit | Commitment H binds value+nonce | Overwrite allowed before deadline — by design |
| Invalid high bid | `valid = value ≤ escrow` excludes from clearing | Escrow still locked until settle |
| Wrong clearing | Deterministic rule in contract | Operator sets rule at create_round |

### Funds

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Winner doesn't pay | Escrow locked at commit; settle pulls from escrow | Requires valid reveal |
| Drand never delivers R | `void` after grace refunds all escrow | Grace window must be configured |
| Double settle | Idempotent settle skips settled bids | Proven in e2e |

### Identity privacy

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Public learns bidder names | Identity only in auditor blob | Values public after reveal by design |
| Wrong auditor reads blob | X25519 AEAD to round auditor pubkey | Auditor key compromise exposes identities |

### Walrus storage layer

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Fake blob id or fake intent id | Main app flow requires real storage adapter result; no mock storage backend | UI can only prove what configured route returns |
| Wrong payload bound to round | `content_hash` and `commitment_hash` are attached on Soroban with blob/intent reference | Users must preserve reveal material if later decryption is needed |
| Walrus/Bosphor unavailable | Create flow blocks when storage configuration is missing or route fails | Availability depends on selected storage route |
| Wallet route confusion | UI exposes one active route: Freighter for Stellar, RainbowKit for Bosphor intent | EVM route still cannot replace Soroban settlement logic |

### Agent / mandate

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Agent exceeds maxBid | Off-chain `assertBidWithinMandate` | **Not Soroban-enforced** — rogue agent could commit higher if funded |
| Agent overpays appraisal | `maxAppraisalSpend` off-chain | Same — requires honest agent code |
| Stolen session key | Caps limit damage to one round/mandate | Principal should rotate; passkey policies in production |

### GOAT / x402 decision layer

| Threat | Mitigation | Residual |
| --- | --- | --- |
| Fake paid decision | `/goat/agent-decision` uses the same x402 resource-server path as `/appraise`; unpaid browser calls receive HTTP 402 | Successful live payment still needs funded x402 setup |
| Local mode mistaken for live GOAT | Response includes `goat.mode`; docs require credentials + `GOAT_LIVE_ENABLED=true` before claiming live execution | Reviewers must inspect returned mode |
| Bad strategy output | Zod schema validates shape, not economic correctness | Users remain responsible for mandate/risk policy |
| Decision leaks private rationale | Store decision artifacts encrypted through Walrus/Bosphor if retained | API server sees request/response by design |

## Trust assumptions

1. **Drand quicknet** — honest threshold signing, public randomness
2. **Soroban host BLS** — correct implementation of BLS12-381 verify
3. **tlock-js / noble crypto** — correct seal/open implementation (tested)
4. **Agent software** — enforces mandate caps before submit
5. **USDC SAC** — standard SEP-41 behavior
6. **Walrus/Bosphor route** — stores encrypted bytes and returns the referenced blob/intent data
7. **GOAT credentials / API** — required only for live GOAT tool execution

## Out of scope (honest limits)

- Mandate caps are **not** enforced in the Round contract
- x402 appraisal price is not on-chain
- GOAT decision quality is not enforced by Soroban; only the later commitment
  and escrow rules are enforced on-chain
- Passkey-Kit wallet demo is wired, but agent mandate enforcement is not moved to Passkey policies
- OZ Relayer Channels adapter is optional; direct RPC remains the proven critical path
- Walrus does not enforce Sub Rosa fairness, reveal, or settlement; it is only encrypted storage
- Stellar/Soroban does not directly call Walrus or Bosphor

## Auditor UI

The web **Auditor** tab demonstrates:

- Decrypting identity blobs with auditor secret (X25519)
- Live bid tlock decrypt after R via quicknet

This matches the selective-disclosure story: values public post-R, identities auditor-only.
