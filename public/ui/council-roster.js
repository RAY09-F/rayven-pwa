// Agent roster from the supplied asgard.html. Example activity is not live data.
export const GODS = {
  "thor": {
    "name": "THOR",
    "sub": "Bilskirnir Core · 5 Councillors",
    "who": "THE STORM COUNCIL",
    "council": [
      {
        "id": "jane_foster",
        "name": "JANE FOSTER",
        "title": "The Seer",
        "c": "#FF7A6B",
        "job": "Finds out. Anything you need to know that lives outside this house — she goes and gets it, reads it, and comes back with the short version.",
        "tools": [
          "Web search",
          "Deep research",
          "Look something up",
          "News"
        ],
        "line": "\"Give me the question. I will bring back the paper it is written on.\"",
        "ask": "what am I missing on this?"
      },
      {
        "id": "valkyrie",
        "name": "VALKYRIE",
        "title": "The Road",
        "c": "#A9C6E8",
        "job": "Gets you there and puts something on while you go. Routes, distances, music, video, and what the sky is doing when you step outside.",
        "tools": [
          "Maps and routes",
          "Spotify",
          "YouTube",
          "Weather"
        ],
        "line": "\"Point at it. I know the way and I will pick the music.\"",
        "ask": "get me there and put something on."
      },
      {
        "id": "hulk",
        "name": "HULK",
        "title": "The Hands",
        "c": "#4FE08A",
        "job": "Does the thing on the screen. Opens the page, reads it, clicks it, types into it, takes the shot. The only one who physically touches the browser.",
        "tools": [
          "Navigate",
          "Read a page",
          "Click and type",
          "Screenshot"
        ],
        "line": "\"Point at the button. It is already pressed.\"",
        "ask": "open it and press the button."
      },
      {
        "id": "korg",
        "name": "KORG",
        "title": "The Herald",
        "c": "#C9B8A6",
        "job": "Reaches people. Texts, calls, and the line to the other two houses — JARVIS and KEVOS — plus anything that needs saying in another language.",
        "tools": [
          "Send a text",
          "Place a call",
          "JARVIS and KEVOS",
          "Translate"
        ],
        "line": "\"I will say it kindly. That is what I am for.\"",
        "ask": "tell Jay and Kevin."
      },
      {
        "id": "darcy",
        "name": "DARCY",
        "title": "The Keeper",
        "c": "#E86BC8",
        "job": "Holds everything you would otherwise forget. What you told him months ago, what is due, what you promised, and when.",
        "tools": [
          "Long-term memory",
          "To-dos",
          "Calendar",
          "Reminders"
        ],
        "line": "\"You already told me. I wrote it down.\"",
        "ask": "what did I promise this week?"
      }
    ],
    "board": {
      "needs": [],
      "running": {
        "who": "",
        "name": "Activity not loaded",
        "pct": 0,
        "steps": [],
        "foot": ""
      },
      "glance": []
    }
  },
  "loki": {
    "name": "LOKI",
    "sub": "The Ledger · 5 Councillors",
    "who": "COUNCIL OF FOLLOW-THROUGH",
    "council": [
      {
        "id": "miss_minutes",
        "name": "MISS MINUTES",
        "title": "The Clock",
        "c": "#FFA23A",
        "job": "Owns time. What is next, how long you have, what you agreed to and when it lands. She is the one who says the hour out loud before you ask.",
        "tools": [
          "Calendar",
          "Reminders",
          "Countdowns",
          "World time"
        ],
        "line": "\"Well now. That is in forty minutes, and you are not dressed.\"",
        "ask": "what is next?"
      },
      {
        "id": "hunter_b15",
        "name": "HUNTER B-15",
        "title": "The Runner",
        "c": "#7FA8CE",
        "job": "Fast research for the brief. Goes out, finds the thing, comes back before the coffee is cold. No opinions, just what is true this morning.",
        "tools": [
          "Web search",
          "News",
          "Research",
          "Look something up"
        ],
        "line": "\"I do not need the whole file. I need the line that matters.\"",
        "ask": "find it fast."
      },
      {
        "id": "mobius",
        "name": "MOBIUS",
        "title": "The Ledger",
        "c": "#D8C08A",
        "job": "Keeps the list. Every to-do, every half-formed idea, every \"I should really\" — written down, ordered, and handed back to you at the right moment.",
        "tools": [
          "To-dos",
          "Ideas",
          "Word ideas",
          "Memory"
        ],
        "line": "\"You said it out loud. That makes it real, and it is on the list.\"",
        "ask": "what is still open?"
      },
      {
        "id": "sylvie",
        "name": "SYLVIE",
        "title": "The Apocalypses",
        "c": "#C8E04A",
        "job": "The world outside the window. Weather, air, currency, odds, and the maths you cannot be bothered to do. Every version of how today could go.",
        "tools": [
          "Weather",
          "Air and world",
          "FX and calculator",
          "Chance"
        ],
        "line": "\"There are a thousand ways this goes. Most of them are fine.\"",
        "ask": "what does today look like?"
      },
      {
        "id": "kang",
        "name": "KANG",
        "title": "The Watch",
        "c": "#A97FE0",
        "job": "Watches things change over time. A page, a price, a listing, a score. He does not tell you it exists — he tells you the moment it moves.",
        "tools": [
          "Watchlist",
          "Subjects",
          "Page history",
          "Pause and resume"
        ],
        "line": "\"I have seen this page before. It was not saying that.\"",
        "ask": "what moved?"
      }
    ],
    "board": {
      "needs": [],
      "running": {
        "who": "",
        "name": "Activity not loaded",
        "pct": 0,
        "steps": [],
        "foot": ""
      },
      "glance": []
    }
  },
  "odin": {
    "name": "ODIN",
    "sub": "Hliðskjálf · 5 Councillors · Paper",
    "who": "THE TRADING COUNCIL",
    "council": [
      {
        "id": "baldr",
        "name": "VOLSTAGG",
        "title": "The Broad Line",
        "c": "#E0604A",
        "job": "Follows the whole market. Trend on SPY — he takes the direction the index is already going and stays with it until it turns. Paper only.",
        "tools": [
          "SPY · trend",
          "Simulated entries",
          "Simulated exits",
          "Position log"
        ],
        "line": "\"The crowd is going somewhere. I am walking with it.\"",
        "ask": "where is the market heading?"
      },
      {
        "id": "vidar",
        "name": "HEIMDALL",
        "title": "The Gold Watch",
        "c": "#D89A4A",
        "job": "Watches gold. Momentum on GLD — he moves when the metal starts moving and steps off when it stops. Paper only.",
        "tools": [
          "GLD · momentum",
          "Simulated entries",
          "Simulated exits",
          "Position log"
        ],
        "line": "\"I see it long before it arrives.\"",
        "ask": "what is gold doing?"
      },
      {
        "id": "tyr",
        "name": "FANDRAL",
        "title": "The Reversal",
        "c": "#6FD08A",
        "job": "Plays the snap-back. Mean-reversion on Bitcoin — when it runs too far from its own average, he bets it comes home. Paper only.",
        "tools": [
          "BTC · mean reversion",
          "Simulated entries",
          "Simulated exits",
          "Position log"
        ],
        "line": "\"Everything that runs too far comes back. Usually.\"",
        "ask": "is bitcoin stretched?"
      },
      {
        "id": "heimdall",
        "name": "HOGUN",
        "title": "The Tech Line",
        "c": "#7FA8CE",
        "job": "Follows the Nasdaq. Trend on QQQ — grim, patient, and unbothered by a bad week. Paper only.",
        "tools": [
          "QQQ · trend",
          "Simulated entries",
          "Simulated exits",
          "Position log"
        ],
        "line": "\"I do not need it to be exciting. I need it to be going up.\"",
        "ask": "how is tech trending?"
      },
      {
        "id": "freya",
        "name": "FRIGGA",
        "title": "The Second Chain",
        "c": "#C79AE8",
        "job": "Watches Ethereum. Momentum on ETH — she takes the move once it has proven itself, not before. Paper only.",
        "tools": [
          "ETH · momentum",
          "Simulated entries",
          "Simulated exits",
          "Position log"
        ],
        "line": "\"I already know how this ends. I am waiting for you to catch up.\"",
        "ask": "what is ether doing?"
      }
    ],
    "board": {
      "needs": [],
      "running": {
        "who": "",
        "name": "Activity not loaded",
        "pct": 0,
        "steps": [],
        "foot": ""
      },
      "glance": []
    }
  }
};
