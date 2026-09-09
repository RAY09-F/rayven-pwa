// One config object per realm. Everything the HUD shows — theme vars, motif,
// nameplate, roster, telemetry, taglines, conversation and the left data module
// — is read from here, so a realm is a data change, never a markup change.
// Copy and numbers are the design handoff's verbatim; live feeds override the
// runtime observations via hud-data.js. Examples below are reference-only and
// must never be displayed as live data.

export const HUES = { violet:'#b98cff', crimson:'#ff6b6b', gold:'#f4d17a', azure:'#6ea8ff', jade:'#4ade80' };
export const DELTA = { up:'#4ade80', down:'#ff8a7a', flat:'var(--ink)' };
export const REALMS = ['thor', 'loki', 'odin'];
export const DEFAULT_REALM = 'odin';

export const THEMES = {
 thor: {
  vars:{'--acc':'#7bb0ff','--acc2':'#b79cff','--ink':'#dfeaff','--dim':'rgba(210,227,255,.66)','--bg':'#050a16','--panel':'rgba(12,22,46,.5)','--line':'rgba(123,176,255,.20)','--glow':'rgba(123,176,255,.20)','--display':"'Cormorant Garamond',serif"},
  realm:'07 / THE ASTRAL CARTOGRAPHER', stageLabel:'CHART / SECTOR IV',
  signal:'ON TRACK 74%', scene:'astral-cartographer',
  desk:{title:'CAMPAIGN', meta:'PLANS', chart:'MOMENTUM 14D',
   stats:[{k:'ACTIVE PLANS',v:'5'},{k:'STEPS DONE',v:'23/31'},{k:'ON TRACK',v:'74%',t:'up'},{k:'NEXT GATE',v:'2D 06H'}],
   rows:[{k:'LAUNCH ROUTE · SIF',v:'ON TRACK',t:'up'},{k:'HIRING LEG · MODI',v:'AT RISK',t:'down'},{k:'CAPITAL RUN · TYR',v:'CLEAR',t:'up'}]},
  tagA:'NODE 03 / LOCKED', tagB:'VECTOR / +0.42',
  leftTag:['FIVE BEARINGS.','ONE HEADING.'], foot:['THE MAP IS NOT THE STORM.','WALK IT ANYWAY.'],
  bottom:['CHART IT.','HOLD THE LINE.','STRIKE ONCE.'],
  microTag:'STEADIER HANDS. TRUER LINES.', counselTag:'FIVE BEARINGS. ONE HEADING.',
  telemetry:[{k:'BEARING',v:'041.6°'},{k:'ALTITUDE',v:'12 400'},{k:'DRIFT',v:'0.03'},{k:'WIND',v:'7 KT'}],
  council:[
   {name:'SIF',domain:'STRATEGY · TERRAIN / MAPPING',hue:'violet'},
   {name:'TYR',domain:'DECISIONS · RISK / RESOLVE',hue:'crimson'},
   {name:'BALDR',domain:'CLARITY · SIGNAL / LIGHT',hue:'gold'},
   {name:'VALKYRIE',domain:'ROUTES · MOMENTUM / SPEED',hue:'azure'},
   {name:'MODI',domain:'FORCE · EXECUTION / DRIVE',hue:'jade'}],
  msgs:[{bot:true,text:'The chart is live. Where are we going?'},{user:true,text:'Turn this idea into a plan.'},{bot:true,text:"Give me the goal. I'll lay the route — five bearings, one heading."}],
  counsel:{name:'VALKYRIE',hue:'azure',line:'The fastest route is not the surest. Two waypoints cost you a day and save you a week.'},
  nameplate:{kind:'thor', word:'THOR', rule:'PRINCE OF ASGARD · THE NORTH VOICE', sub:'MAP THE NEXT STEP.'}
 },
 loki: {
  vars:{'--acc':'#3ddc84','--acc2':'#e9c46a','--ink':'#d8f6e6','--dim':'rgba(200,240,218,.66)','--bg':'#04100a','--panel':'rgba(8,26,18,.5)','--line':'rgba(61,220,132,.20)','--glow':'rgba(61,220,132,.18)','--display':"'Cormorant Garamond',serif"},
  realm:'09 / THE BIFROST PRISM FOUNDRY', stageLabel:'FORGE / PRISM 03',
  signal:'3 DUE TODAY', scene:'prism-foundry',
  desk:{title:'DAY BOARD', meta:'TODAY', chart:'LOAD BY HOUR',
   stats:[{k:'MEETINGS',v:'4'},{k:'REMINDERS',v:'9'},{k:'DUE TODAY',v:'3',t:'down'},{k:'FREE BLOCK',v:'2H 40M',t:'up'}],
   rows:[{k:'10:30 · STANDUP',v:'25M'},{k:'14:00 · DESIGN REVIEW',v:'1H'},{k:'REMIND · CALL BACK KARI',v:'18:00',t:'down'}]},
  tagA:'FACET 07 / SPLIT', tagB:'VARIANT / 12',
  leftTag:['FIVE MIRRORS.','ONE WAY THROUGH.'], foot:['NOTHING IS FIXED.','THAT IS THE GOOD NEWS.'],
  bottom:['TWIST IT.','TEST IT.','TAKE IT.'],
  microTag:'STRANGER ANGLES. BETTER ODDS.', counselTag:'FIVE MIRRORS. ONE WAY THROUGH.',
  telemetry:[{k:'PHASE',v:'0.618'},{k:'FACETS',v:'07'},{k:'VARIANTS',v:'12'},{k:'SEED',v:'4A9'}],
  council:[
   {name:'SIGYN',domain:'LOYALTY · CONSTRAINT / TRUTH',hue:'violet'},
   {name:'FENRIR',domain:'APPETITE · SCALE / BREAK',hue:'crimson'},
   {name:'ANGRBODA',domain:'WILD IDEAS · CHANCE / SEED',hue:'gold'},
   {name:'JORMUNGANDR',domain:'LOOPS · SYSTEMS / RECURSION',hue:'azure'},
   {name:'HEL',domain:'ENDINGS · CLEANUP / COST',hue:'jade'}],
  msgs:[{bot:true,text:"What's on your mind?"},{user:true,text:'Show me another way through this.'},{bot:true,text:'Every shape holds another. Let me find the one no one expected.'}],
  counsel:{name:'JORMUNGANDR',hue:'azure',line:'You have solved this before. The loop is the lesson — break it or ride it.'},
  nameplate:{kind:'loki', word:'LOKI', rule:'GOD OF MISCHIEF · THE ONE WHO MAKES', sub:'GIVE POSSIBILITY A SHAPE.'}
 },
 odin: {
  vars:{'--acc':'#e8c06a','--acc2':'#f6e3a1','--ink':'#f2e8d5','--dim':'rgba(242,232,213,.64)','--bg':'#07060a','--panel':'rgba(24,19,13,.55)','--line':'rgba(232,192,106,.20)','--glow':'rgba(232,192,106,.16)','--display':"'Cinzel',serif"},
  realm:'13 / THE SOLAR THRONE', stageLabel:'THRONE / SOLAR RING',
  signal:'WIN RATE 68%', scene:'solar-throne',
  desk:{title:'PAPER DESK', meta:'SIM', chart:'EQUITY 30D',
   stats:[{k:'TRADES OPEN',v:'7'},{k:'CLOSED TODAY',v:'12'},{k:'WIN / LOSS',v:'68 / 32',t:'up'},{k:'NET P/L',v:'+$4,182',t:'up'}],
   rows:[{k:'ETH LONG · FRIGGA',v:'+$612',t:'up'},{k:'BTC SHORT · FANDRAL',v:'-$188',t:'down'},{k:'GOLD LONG · HEIMDALL',v:'+$1,204',t:'up'}]},
  tagA:'RING 09 / SEALED', tagB:'AURUM / 1.000',
  leftTag:['FIVE PERSPECTIVES.','A CLEARER TOMORROW.'], foot:['DIFFERENT PERSPECTIVES.','A STRONGER YOU.'],
  bottom:['THINK DEEPER.','SEE FURTHER.','MOVE WISER.'],
  microTag:'CLEARER THINKING. BRIGHTER MOVES.', counselTag:'FIVE PERSPECTIVES. ONE DIRECTION.',
  telemetry:[{k:'AURUM',v:'1.000'},{k:'COUNCIL',v:'5/5'},{k:'DEPTH',v:'IX'},{k:'RING',v:'09'}],
  council:[
   {name:'FRIGGA',domain:'FORESIGHT · TRENDS / MOMENTUM',hue:'violet'},
   {name:'VOLSTAGG',domain:'SUPPLY · GROWTH / PEOPLE',hue:'crimson'},
   {name:'HEIMDALL',domain:'WATCH · GEO / ALERTS',hue:'gold'},
   {name:'HOGUN',domain:'MACRO · FLOW / DISCIPLINE',hue:'azure'},
   {name:'FANDRAL',domain:'RISK · EXECUTION / NERVE',hue:'jade'}],
  msgs:[{bot:true,text:'Ready when you are.'},{user:true,text:'Help me shape the next step.'},{bot:true,text:"Let's look at this with all five perspectives and find the clearest path forward."}],
  counsel:{name:'VOLSTAGG',hue:'crimson',line:'Consider where supply, growth, and people dynamics align for the next step.'},
  nameplate:{kind:'odin', word:'ODIN', rule:'ALL FATHER · THE SOURCE', sub:'PAPER / SIM · FIVE PERSPECTIVES'}
 }
};

export const TICKER_DEFAULT = 'Events unavailable';

// Deterministic bar timings so the rails animate out of phase without random().
export function seq(n, lo, hi) {
 return Array.from({length: n}, (_, i) => {
  const f = (Math.sin(i * 12.9898) + 1) / 2;
  return { dur: (lo + f * (hi - lo)).toFixed(2) + 's', delay: ((i % 7) * 0.13).toFixed(2) + 's' };
 });
}
export const deltaColor = t => DELTA[t] || DELTA.flat;
