# Thor reference model

`public/ui/realm-thor.js` exports `createThor(THREE, options)` under the shared contract. Original geometry follows the supplied Thor reference: diagonal suspended Mjolnir with a beveled steel head, independently modeled endcaps, recessed faceplates, bronze knot inlay, rivets, dark wrapped handle, collar, pommel and leather loop. Three solid annular bronze bands have bevels, edge piping, rivets and two cardinal ornaments. The stepped dark metal dais carries blue seams, machined graduations, concentric map grids, irregular contour lines and small ridge traces.

The integration owns advisor gemstones and arrangement. `hero` contains the hammer, armillary and chart; its position is never overwritten. Named hammer, armillary band and projection groups move slowly on independent axes. Work states activate a small electrical arc and brighter energy inlay. `animated=false` freezes transforms; work-state feedback still responds. Motion time pauses rather than jumping when resumed.

`preview:true` omits the foundation and cartographic geometry for small renderer-shared thumbnails. All geometries/materials are factory-owned and disposed exactly once; no textures, imports, global listeners, timers, or frame allocations.

Validation with bundled Three r185 in Node: all position attributes finite; full model 224 meshes / 41,279 vertices; bounds X/Z ±2.24 and Y .01–3.738 (foundation included). Verified arrangement position survives updates, still freezes hammer motion, and repeated disposal is safe. Visual integration and lighting are lead-owned.

## Integrated-view refinement

The hammer now sits ahead of the armillary, pitches its silver face toward the elevated camera, and has a wider/deeper head with brighter, less mirror-dependent steel. Armillary bands are wider, the crossing equatorial band sits lower, and the assembly moves rearward to frame the hammer. Mjolnir body height is approximately 2.69 including the loop. Identical geometry is deduplicated and repeated rivets, ticks, wraps and braces become parent-local instances, preserving separate band animation. Full model now has 79 unique geometries / 91 drawable objects, down from 253; preview has 36 unique geometries / 48 drawable objects. Revalidated finite attributes, placement preservation, and disposal using local Three. Lead to verify refined integrated view.
