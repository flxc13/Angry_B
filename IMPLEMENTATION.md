# ISSUE 04 implementation checklist

## Giant specialization vertical slice — 2026-09-29

- [x] Preserve existing game copy and pre-existing workspace edits; new UI copy uses colloquial Cantonese.
- [x] Separate giant plunge from legacy combined skill; bounded steering, height damage and actual contact-triggered landing.
- [x] Ten special nodes; deterministic initial / exclusive branch / mutation milestones; useful capped offers only.
- [x] Quake travelling ground waves and one optional echo; magnet bounded real-body collection/release, no relay theft.
- [x] Three-contact giant ultimate (two rebounds, optional timed final plunge), charge persistence, per-shot charge budget.
- [x] Canvas-local touch-size action buttons, keyboard E/Q/arrows, target preview, compact progression tree.
- [x] Five curated arenas; both branches pass five-wave actual-shot regression.
- [x] v2 validated saves with v1 migration; versioned local run records.
- [x] 43 automated suites pass; 15 campaigns unchanged; four responsive sizes checked with no overflow.
- [ ] Visible-tab manual timing, physical mobile play, sound listening and late-run balancing still required.
- [ ] Other three specialty trees, workshop routes and full boss redesign are follow-up scope.

The checklist below records the earlier base release, not this slice's test count. Source files are updated locally; this task does not publish GitHub Pages or regenerate the old portable distribution.

- [x] Preserve 15 campaign layouts, original assets, audio and dialogue.
- [x] Separate endless lifecycle, 4 starts, 24 capped hybrid upgrades, 12 seeded templates.
- [x] Escalating HP/material difficulty, every-5 elites, every-10 relay/window boss.
- [x] Shield/repair/commander mechanics, stone/metal/elastic materials.
- [x] Normal/elite/supply routes, 6 initial ammo, +3 refill, cap 8, initial challenge ammo 4–8.
- [x] Immutable 28% seeded endless events, disabled settings explanation, good/bad bounded events.
- [x] Global train nerf: physical collisions and one local burst; no timed auto-clear.
- [x] Multi-projectile skill tracking/settlement, bounded microsteps and conservative broadphase.
- [x] Keyboard/mobile skill controls, responsive comic panels.
- [x] Local seed/daily records, achievements, cosmetic halos, validated boundary-only checkpoints.
- [x] Dependency-free Node VM rules and real-engine regression harness.
- [x] Final expanded test run: 24 suites passed; browser DOM/rendering/responsive smoke checks completed with hidden-tab limitations documented.
- [x] Updated documentation, syntax/diagnostics checks and portable distribution regeneration (source/hash verification in final validation).

Scope: this is a local offline challenge, not an online leaderboard or anti-cheat system. No mid-flight replay/resume; wave restarts are intentional. No new dependencies. Bounded broadphase is a bounding-volume rejection pass, not a spatial hash. Device FPS and exhaustive infinite-run balance cannot be certified by automated tests.