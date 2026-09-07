# Rendered Realms design direction

ASGARD becomes a spatial council room around a distinctive physical relic. The chamber stays visible beside the conversation. A single Arsenal opens the much larger capability surface on demand.

## Persona construction

- **Thor:** modeled hammer, angled steel head, cheek plates, grooves, wrapped handle, grip rings and layered pearl structures. Storm-blue light.
- **Loki:** yellow faceted crystal, modeled luminous edges and intersecting pearl ribbons. Sylvie remains green. The interface retains Loki's emerald accents so yellow belongs to the core itself.
- **Odin:** mechanical iris, layered metal hoops and sixteen physical index markers. Gold lighting and quarter markers give the eye structure.

Focused relic groups are enlarged by 13%; plinth geometry remains separate. The shared realm adds three receding architectural frames, three circular dais rails, 32 segmented floor marks, five faceted advisor meshes with pedestals and real 3D tethers. There are 15 advisor gems across the three realms, not 15 additional personas. Mesh picking selects dossiers; accessible labeled buttons provide the same council access.

## Palette and materials

Background `#070D13`, surface `#0D1924`, text `#E8EDF4`, muted text `#A0ADBD`. Thor accent `#A9D8F5`, Loki UI accent `#9BE5C3`, yellow core approximately `#E7C24A`, Odin accent `#E5C288`. Dark metal, selective pearl surfaces and luminous edges provide separation. Transparent surfaces are limited to supporting structures. The existing Cinzel/Inter styling has Georgia/system fallbacks; the external font import is inherited, not a new dependency.

The desktop composition has a larger left chamber and a narrower readable chat panel. The toolbar exposes Chat, Arsenal, Mission briefs and Activity. Revenue tools, workflow drafts and proposed integrations are inside the Arsenal, preserving an uncluttered default room.

## Motion and fallback

One scene owner animates the core and council. Listening, thinking and speaking use actual application state. Speaking is a state-based pulse, not measured audio amplitude. Advisor motion is ambient; it is not evidence that a councillor is working. No confidence/load/progress numbers are fabricated.

Pointer drag changes a bounded viewing angle; Reset view restores it. Reduced motion and still settings preserve a complete stationary composition. Hidden pages pause unnecessary frames. DPR stays capped; existing quality tiers and resource cleanup are retained.

On WebGL failure, the same scene geometry produces a simplified still projection. Filled intersecting ribbons are replaced by edge projections in that fallback only to avoid painter-order artifacts. The label says “Still view · simplified rendering.” This output is deliberately not presented as the GPU result.

## Mobile

Phone layouts stack the chamber and chat; they do not shrink the desktop grid. The Chat shortcut scrolls to and focuses the composer. Council controls wrap. Arsenal sections use a two-column navigation row and single-column tool cards. Numeric and text fields use readable mobile sizes. Physical keyboard, voice permissions and GPU quality still require a real-device pass.
