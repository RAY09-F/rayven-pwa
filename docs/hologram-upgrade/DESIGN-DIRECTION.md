# Holographic personas — design direction

## Identity and hierarchy

ASGARD now centres on a large, recognizable procedural portrait made from spatial particles and luminous contours. The persona is the visual anchor. A compact row of supporting council members remains available below it; the microagents no longer compete with five large objects arranged around the main presence.

This is a live rendered interface, with three distinct model constructions rather than one shape recoloured three times. Existing conversation, settings and tool access remain ordinary readable HTML alongside the scene.

| Persona | Model silhouette | Hologram colours | Interface accent |
| --- | --- | --- | --- |
| Thor | Broad armoured shoulders, storm helmet, swept temple wings and short beard | Cyan `#71CFFF`, ice `#C8F1FF` | `#85DCFF` |
| Loki | Leaner face, angular headpiece and tall curved physical horns | Yellow/gold `#FFD76B`, emerald `#57E6B1` detail | `#F4D873` |
| Odin | Crown, long segmented beard and asymmetric eye treatment | Warm gold `#F2C580`, ivory `#FFF0D4` | `#EDC68A` |

Loki's primary portrait stays yellow/gold, respecting the earlier colour direction. Sylvie retains her green council identity. No additional public persona is introduced.

## Geometry and materials

`public/ui/hologram-persona.js` constructs faces, necks, armour, horns, crowns and facial contours as real Three.js geometry. Deterministic area-weighted surface sampling supplies the portrait particles. Bright feature paths preserve eyes, nose and face structure when motion is disabled.

The material treatment combines faint additive surfaces, controlled contour light and a locally generated particle sprite. Dark negative space remains visible through the portrait. The result intentionally reads as a hologram rather than a solid metallic statue or a flat image of one.

Balanced quality draws 7,000 particles; high draws 12,000. A 3,600-particle low budget exists in the model module. The current user quality control exposes balanced and high. Switching quality reuses buffers rather than rebuilding the portrait.

## Composition and typography

The background uses near-black navy `#030A11`, with dark surfaces `#0A1722`, readable primary text `#E8F4FA` and muted text `#9AAFBE`. Fine structural borders and limited accent light provide depth without outlining every control in neon.

Cinzel gives names and large titles an architectural character; Inter handles conversation and controls, with Georgia/system fallbacks. The existing Google Fonts import remains optional to readability. The desktop layout gives the scene the larger share of space and places conversation in a narrower adjacent column. Headings occupy a peripheral area, leaving the face and silhouette prominent.

On phones, the portrait precedes conversation in a single column. The supporting council becomes a compact row, and Chat brings the existing composer into view. Drafts remain associated with their persona. The phone treatment is a separate composition, not a scaled desktop screenshot.

## Motion and interaction

Selecting Thor, Loki or Odin replaces the procedural portrait and updates the current conversation identity. A brief particle assembly settles into the exact resting portrait. Small rotation, light and scan changes respond to existing application state. Dragging changes the camera angle; Reset view restores its initial orientation.

Listening, connecting, thinking, speaking and errors retain plain status labels. Speaking animation is state-based, not measured audio amplitude. Council member controls open their existing dossiers; their presence does not claim that unseen background work is running.

Still mode and the operating system's reduced-motion preference suppress continuous animation and complete the assembly immediately. The static portrait retains its geometry, facial detail and luminous material identity.

## Rendering approach and fallback

The scene uses locally vendored Three.js without introducing a frontend framework or build step. WebGL is preferred. If initialization or the graphics context fails, a fresh Canvas2D surface projects the same model buffers through the Three.js perspective camera, including depth ordering and camera orbit. This is explicitly labelled **Software 3D projection**.

The current cloud-browser visual review covers that CPU projection. GPU appearance and sustained performance still require a WebGL-enabled device. Existing backend services, tool classifications and approval boundaries are preserved; this design iteration does not imply that proposed integrations became working services.
