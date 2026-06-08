/*
 * PHOENIX WHEELS: LAUNCH QUEST  —  game content
 * ------------------------------------------------------------------
 * This file holds all the "worlds", "quests", the do/don't lessons,
 * and the data-capture fields. It is intentionally separate from the
 * game engine (game.js) so the content can be edited without touching
 * the code.
 *
 * IMPORTANT: This is an educational planning game, not legal, tax, or
 * insurance advice. Always confirm the specifics with the relevant PA /
 * Montgomery County / borough office and your own professionals.
 * ------------------------------------------------------------------
 */

/* The shop's real-world facts, shown around the game. */
const SHOP = {
  name: "Phoenix Wheels",
  blurb: "An everything-wheels pop-up: skateboards, scooters, derby skates & rollerblades. No bikes.",
  zip: "19460",
  area: "Royersford / Phoenixville area, Montgomery County, PA",
  nonprofit: "Perednik Foundation (fiscal/nonprofit home)",
  forprofit: "Kalmans Forge (LLC + C-corp)"
};

/* Worlds = stages of the journey, played roughly in order. */
const WORLDS = [
  { id: "w1", name: "Foundation Flats",   icon: "🏛️", color: "#7c5cff", tag: "Structure & Legal" },
  { id: "w2", name: "Permit Park",        icon: "📋", color: "#ff7ad9", tag: "Permits & Compliance" },
  { id: "w3", name: "Risk Ramp",          icon: "🛡️", color: "#ff5c5c", tag: "Insurance & Safety" },
  { id: "w4", name: "Funding Bowl",       icon: "💰", color: "#ffd23f", tag: "Money & Grants" },
  { id: "w5", name: "Supply Street",      icon: "📦", color: "#3fd6a0", tag: "Inventory & Vendors" },
  { id: "w6", name: "Launch Halfpipe",    icon: "🚀", color: "#3fb6ff", tag: "Brand & Grand Opening" }
];

/*
 * Each quest:
 *  id, world, title, icon, points
 *  intro:   short 8-bit "mission briefing"
 *  lessons: do/don't scenario cards [{q, options:[{t, correct, why}]}]
 *  capture: real planning fields she fills in [{id,label,type,placeholder,options?,help?}]
 *  pitfalls:[strings]  — common mistakes
 *  wins:    [strings]  — pro moves
 */
const QUESTS = [
  /* ---------------- WORLD 1 — FOUNDATION ---------------- */
  {
    id: "q_structure",
    world: "w1",
    title: "Pick Your Legal Body",
    icon: "🧩",
    points: 150,
    intro: "Before a single wheel is sold, Phoenix Wheels needs a 'body' to live in. You already have the Perednik Foundation (nonprofit) and Kalmans Forge (LLC + C-corp). Choose how the pop-up runs through them.",
    lessons: [
      {
        q: "Phoenix Wheels is meant to be a NONPROFIT pop-up. What's the cleanest path right now?",
        options: [
          { t: "Run it as a program UNDER the Perednik Foundation (fiscal home)", correct: true,
            why: "Smart. A pop-up doesn't need its own brand-new 501(c)(3). Operating as a named program/project of an existing nonprofit lets you use its tax-exempt status, EIN, and banking immediately — fastest legal path to selling." },
          { t: "Spin up a brand-new separate 501(c)(3) before the pop-up", correct: false,
            why: "Filing a new 501(c)(3) (IRS Form 1023) can take months and costs money. For a pop-up, that delay can kill the launch. Use the foundation you already have, then split it out later if it grows." },
          { t: "Run the pop-up's sales through Kalmans Forge (for-profit)", correct: false,
            why: "Mixing nonprofit branding with for-profit sales blurs the line and risks your foundation's standing. Keep nonprofit activity inside the nonprofit." }
        ]
      },
      {
        q: "You want to use the name 'Phoenix Wheels' publicly while the legal entity is 'Perednik Foundation'. What do you do?",
        options: [
          { t: "Register 'Phoenix Wheels' as a fictitious name (DBA) in PA", correct: true,
            why: "PA requires a Fictitious Name registration to operate under a name different from the legal entity. It's cheap, fast, and lets the foundation legally trade as 'Phoenix Wheels'." },
          { t: "Just start using the name — names aren't regulated", correct: false,
            why: "Using a trade name without registering it is a compliance gap in PA and can cause bank/permit headaches. Register the DBA." }
        ]
      }
    ],
    capture: [
      { id: "structure_choice", label: "How Phoenix Wheels will operate", type: "select",
        options: ["Program under Perednik Foundation", "Own new nonprofit (later)", "Undecided — need advice"] },
      { id: "dba_name", label: "Trade name to register (DBA)", type: "text", placeholder: "Phoenix Wheels" },
      { id: "ein_status", label: "EIN you'll use", type: "select",
        options: ["Use Perednik Foundation EIN", "Apply for new EIN", "Not sure yet"] },
      { id: "structure_date", label: "Target date to finalize structure", type: "date" }
    ],
    pitfalls: [
      "Creating a brand-new nonprofit when an existing one can host the pop-up.",
      "Operating under a trade name without filing the PA Fictitious Name registration.",
      "Co-mingling nonprofit and for-profit (Kalmans Forge) money in one account."
    ],
    wins: [
      "Run as a program of Perednik to launch in weeks, not months.",
      "File the DBA so banks/permits accept the 'Phoenix Wheels' name."
    ]
  },
  {
    id: "q_mission",
    world: "w1",
    title: "Write the Mission Coin",
    icon: "🎯",
    points: 120,
    intro: "Grants, sponsors, and the town will all ask the same thing: WHY does Phoenix Wheels exist? A one-sentence mission is your most reusable power-up.",
    lessons: [
      {
        q: "Which mission opens the most doors (grants + community goodwill)?",
        options: [
          { t: "'We sell skate gear.'", correct: false,
            why: "True, but it's just retail. Funders and the borough rarely rally behind 'we sell stuff.'" },
          { t: "'We grow an inclusive wheels community — getting kids and adults rolling on skateboards, scooters & skates — through affordable gear and local events.'", correct: true,
            why: "This frames Phoenix Wheels as community impact (youth, inclusion, health). That's what unlocks grants, fee waivers, and partnerships — while you still sell gear to fund it." }
        ]
      },
      {
        q: "Derby skates + rollerblades + scooters + boards, but NO bikes. Should the mission name the niche?",
        options: [
          { t: "Yes — own 'everything wheels except bikes'", correct: true,
            why: "A clear niche makes you memorable and avoids competing head-on with bike shops. 'Everything that rolls — minus bikes' is a story people repeat." },
          { t: "No — stay vague to seem bigger", correct: false,
            why: "Vague = forgettable. A sharp niche is easier to market and fund." }
        ]
      }
    ],
    capture: [
      { id: "mission", label: "Your one-sentence mission", type: "textarea", placeholder: "Phoenix Wheels exists to…" },
      { id: "who_served", label: "Who you serve (audience)", type: "text", placeholder: "Local kids, families, derby league, new skaters…" },
      { id: "why_nonprofit", label: "Why nonprofit fits this", type: "textarea", placeholder: "Affordable access, youth programs, reinvest profits…" }
    ],
    pitfalls: ["A mission that's only about selling product.", "Trying to be everything to everyone."],
    wins: ["Lead with community impact; fund it through sales.", "Own the 'no bikes, all wheels' niche."]
  },

  /* ---------------- WORLD 2 — PERMITS ---------------- */
  {
    id: "q_salestax",
    world: "w2",
    title: "Sales Tax License",
    icon: "🧾",
    points: 140,
    intro: "Surprise: even a nonprofit usually must collect PA sales tax when it SELLS goods to the public. Get the license before opening day.",
    lessons: [
      {
        q: "Phoenix Wheels (nonprofit) will sell skateboards to the public. Sales tax?",
        options: [
          { t: "Register for a PA Sales Tax License and collect 6% on taxable goods", correct: true,
            why: "Right. Being a nonprofit may make your PURCHASES exempt, but SELLING tangible goods to the public is generally taxable. You need a Sales, Use & Hotel Occupancy Tax license (free, via PA myPATH) and must collect/remit." },
          { t: "Nonprofits never charge sales tax", correct: false,
            why: "Common myth. Nonprofit status helps with what you BUY, not what you SELL at retail. Skipping this creates back-tax liability." }
        ]
      },
      {
        q: "Where do you register in PA?",
        options: [
          { t: "PA Department of Revenue — myPATH (online, the PA-100 enterprise registration)", correct: true,
            why: "myPATH / PA-100 is the one-stop registration for the sales tax license and other state accounts." },
          { t: "The borough tax office", correct: false,
            why: "Sales tax is STATE (PA Dept. of Revenue), not the borough. The borough handles local permits/zoning instead." }
        ]
      }
    ],
    capture: [
      { id: "salestax_status", label: "PA Sales Tax License status", type: "select",
        options: ["Not started", "Applied on myPATH", "License received"] },
      { id: "salestax_number", label: "License number (when issued)", type: "text", placeholder: "########" },
      { id: "pos_tax", label: "How POS will charge 6% tax", type: "text", placeholder: "Square / Shopify tax setting…" }
    ],
    pitfalls: ["Assuming nonprofit = no sales tax on what you sell.", "Opening before the license is active."],
    wins: ["Register free on myPATH/PA-100.", "Set your POS to auto-add 6% so books stay clean."]
  },
  {
    id: "q_localpermit",
    world: "w2",
    title: "Borough Permit & Zoning",
    icon: "🏪",
    points: 150,
    intro: "A pop-up still lives somewhere physical. The borough (19460 area) cares WHERE you set up and may want a permit. Call them BEFORE you sign a space.",
    lessons: [
      {
        q: "You found a great vacant storefront for the pop-up. First move?",
        options: [
          { t: "Call the borough zoning/codes office to confirm retail is allowed there + ask what permit a temporary pop-up needs", correct: true,
            why: "Zoning controls what can operate where. A 5-minute call avoids signing a lease for a space you legally can't sell from. Ask specifically about temporary/seasonal vendor or transient retail permits." },
          { t: "Sign the lease, sort permits after", correct: false,
            why: "Classic costly mistake. If zoning blocks retail or the permit is denied, you're stuck paying rent on a space you can't use." }
        ]
      },
      {
        q: "The pop-up is inside an existing market/event for a weekend. Permit?",
        options: [
          { t: "Ask the host/venue — they often hold a master vendor permit you operate under", correct: true,
            why: "At markets, fairs, or host venues, the organizer frequently carries the permit/insurance umbrella. Confirm in writing what they cover vs. what you must provide." },
          { t: "Always file your own full permit regardless", correct: false,
            why: "Sometimes needed, but duplicating the host's permit wastes time/money. Always ask the host first." }
        ]
      }
    ],
    capture: [
      { id: "location", label: "Pop-up location / address", type: "text", placeholder: "Storefront, market, event…" },
      { id: "zoning_ok", label: "Zoning confirmed for retail?", type: "select", options: ["Not checked", "Called borough — OK", "Need variance/approval"] },
      { id: "permit_type", label: "Permit type needed", type: "text", placeholder: "Temporary vendor / occupancy / host-covered" },
      { id: "permit_date", label: "Target date permit secured", type: "date" }
    ],
    pitfalls: ["Signing a lease before confirming zoning/permits.", "Assuming a pop-up needs no permit at all."],
    wins: ["Call borough codes/zoning first.", "If inside a host event, operate under their master permit."]
  },

  /* ---------------- WORLD 3 — INSURANCE ---------------- */
  {
    id: "q_liability",
    world: "w3",
    title: "Liability Shield",
    icon: "🛡️",
    points: 160,
    intro: "You sell things people strap to their feet and ride at speed. Insurance isn't optional — it's the shield that keeps one accident from ending the dream.",
    lessons: [
      {
        q: "Which coverage matters MOST for selling skates, boards & scooters?",
        options: [
          { t: "General liability + PRODUCT liability", correct: true,
            why: "General liability covers slips/trips at your space; PRODUCT liability covers harm from gear you sold (a wheel fails, a board cracks). For wheeled sports gear, product liability is essential." },
          { t: "Only general liability is needed for a pop-up", correct: false,
            why: "General liability alone may NOT cover a claim from a product you sold causing injury. For this niche, you want product liability too." }
        ]
      },
      {
        q: "You'll let people try skates in a small demo area. Smart add-on?",
        options: [
          { t: "Signed waivers + confirm your policy covers on-site demos", correct: true,
            why: "A 'try it' zone raises injury odds. Waivers plus the right policy endorsement protect you. Check the venue requires you to name them as 'additional insured' too." },
          { t: "Skip waivers — they scare customers", correct: false,
            why: "A friendly waiver is standard at skate venues and far less scary than a lawsuit. Keep it short and welcoming." }
        ]
      }
    ],
    capture: [
      { id: "insurer", label: "Insurer / broker you'll use", type: "text", placeholder: "Broker name…" },
      { id: "coverage_types", label: "Coverages to get", type: "text", placeholder: "General + product liability, event…" },
      { id: "coverage_amount", label: "Coverage limit target", type: "text", placeholder: "$1M / $2M aggregate" },
      { id: "waiver_ready", label: "Demo waiver ready?", type: "select", options: ["Not needed", "Drafting", "Ready"] },
      { id: "insurance_date", label: "Target date coverage active", type: "date" }
    ],
    pitfalls: ["Carrying general liability but no product liability.", "Letting people demo gear with no waiver/coverage."],
    wins: ["Bundle general + product liability for wheeled gear.", "Name the venue as additional insured when required."]
  },

  /* ---------------- WORLD 4 — FUNDING ---------------- */
  {
    id: "q_bankbudget",
    world: "w4",
    title: "Bank & Budget Boss",
    icon: "🏦",
    points: 130,
    intro: "Money in, money out — and never mixed. Set up clean nonprofit banking and a simple budget so every dollar is traceable for grants and taxes.",
    lessons: [
      {
        q: "How should Phoenix Wheels money be handled?",
        options: [
          { t: "Separate nonprofit bank account (under Perednik), never mixed with personal or Kalmans Forge", correct: true,
            why: "Clean separation is non-negotiable for a nonprofit. It protects tax-exempt status, makes grant reporting easy, and keeps the for-profit (Kalmans Forge) clearly distinct." },
          { t: "Use a personal account at first to move fast", correct: false,
            why: "Co-mingling funds is one of the fastest ways to jeopardize nonprofit status and create an audit/tax mess." }
        ]
      },
      {
        q: "What's the realistic budget mindset for a pop-up?",
        options: [
          { t: "Start lean: small inventory, low fixed costs, reinvest early sales", correct: true,
            why: "Pop-ups win by staying lean. Test demand with a tight product set before committing big money to inventory or a long lease." },
          { t: "Stock deep on day one to look established", correct: false,
            why: "Over-buying inventory is the #1 cash killer for new shops. Unsold boards = trapped money." }
        ]
      }
    ],
    capture: [
      { id: "bank_status", label: "Nonprofit bank account", type: "select", options: ["Not opened", "Opening soon", "Open"] },
      { id: "startup_budget", label: "Startup budget (estimate)", type: "number", placeholder: "5000" },
      { id: "monthly_costs", label: "Expected monthly fixed costs", type: "number", placeholder: "800" },
      { id: "pos_choice", label: "POS / payment processor", type: "text", placeholder: "Square, Shopify, Clover…" }
    ],
    pitfalls: ["Mixing personal/for-profit/nonprofit money.", "Over-stocking inventory before testing demand."],
    wins: ["One dedicated nonprofit account.", "Start lean and reinvest early revenue."]
  },
  {
    id: "q_grants",
    world: "w4",
    title: "Grant Hunt",
    icon: "💎",
    points: 170,
    intro: "This is where being a nonprofit pays off. Skate & youth-sport funders exist — but grants reward a clear story, a budget, and outcomes. Bag the treasure.",
    lessons: [
      {
        q: "Which grant angle fits Phoenix Wheels best?",
        options: [
          { t: "Youth access + skate community grants (e.g., skatepark/skate-sport foundations, local community & health foundations)", correct: true,
            why: "Funders like skate-focused foundations and local community/health funds back exactly this: getting youth active and building inclusive skate community. Lead with impact + numbers served." },
          { t: "Apply to every grant regardless of fit", correct: false,
            why: "Spray-and-pray wastes time and burns goodwill. Target funders whose mission matches yours — your win rate jumps." }
        ]
      },
      {
        q: "A grant asks for 'outcomes you'll measure'. Best answer?",
        options: [
          { t: "Concrete numbers: kids equipped, events held, new skaters, gear distributed", correct: true,
            why: "Funders fund measurable impact. Specific outcomes (and how you'll count them) make you fundable and easy to renew." },
          { t: "'We'll help the community a lot.'", correct: false,
            why: "Vague outcomes read as unserious. Give numbers you can actually track." }
        ]
      }
    ],
    capture: [
      { id: "grant_targets", label: "Grants/funders to pursue", type: "textarea", placeholder: "List funders + deadlines…" },
      { id: "grant_amount", label: "Total grant funding goal", type: "number", placeholder: "10000" },
      { id: "outcomes", label: "Outcomes you'll measure", type: "textarea", placeholder: "# kids equipped, events held, new skaters…" },
      { id: "grant_deadline", label: "Next grant deadline", type: "date" }
    ],
    pitfalls: ["Applying to grants that don't match your mission.", "Promising vague, unmeasurable outcomes."],
    wins: ["Target skate/youth/community funders.", "Lead with measurable impact numbers."]
  },

  /* ---------------- WORLD 5 — INVENTORY ---------------- */
  {
    id: "q_inventory",
    world: "w5",
    title: "Stock the Quiver",
    icon: "📦",
    points: 140,
    intro: "Skateboards, scooters, derby skates, rollerblades — the right mix, the right amount. No bikes. Choose what fills the shelves on day one.",
    lessons: [
      {
        q: "How deep should opening inventory go?",
        options: [
          { t: "A tight, curated set across all 4 categories; reorder what sells", correct: true,
            why: "Curate, don't hoard. Carry a few strong options in boards, scooters, derby skates, and blades, plus fast-moving essentials (wheels, bearings, pads, helmets). Reorder winners; never tie up cash in slow stock." },
          { t: "One of everything from every brand", correct: false,
            why: "That's how you drown in dead stock. Breadth without data = trapped cash." }
        ]
      },
      {
        q: "A distributor offers a big discount for a large opening order. Do you?",
        options: [
          { t: "Negotiate net-30 terms and start smaller; prove demand first", correct: true,
            why: "Net terms let you sell before you pay. Starting smaller protects cash. Scale orders once you see what your town actually buys." },
          { t: "Max out the discount with a huge upfront buy", correct: false,
            why: "A discount on stock you can't sell isn't a deal — it's frozen money. Demand first, volume later." }
        ]
      }
    ],
    capture: [
      { id: "categories", label: "Categories at launch", type: "text", placeholder: "Boards, scooters, derby skates, rollerblades, pads/helmets" },
      { id: "suppliers", label: "Suppliers / distributors", type: "textarea", placeholder: "Wholesale accounts, contacts, terms…" },
      { id: "opening_units", label: "Approx. opening inventory $", type: "number", placeholder: "3000" },
      { id: "best_bets", label: "Your safest bestsellers (gut call)", type: "text", placeholder: "Complete boards, helmets, scooters…" }
    ],
    pitfalls: ["Over-ordering to chase a discount.", "Carrying too many SKUs with no sales data."],
    wins: ["Curate a tight mix; reorder winners.", "Use net-30 terms to sell before you pay."]
  },

  /* ---------------- WORLD 6 — LAUNCH ---------------- */
  {
    id: "q_brand",
    world: "w6",
    title: "Brand & Buzz",
    icon: "📣",
    points: 120,
    intro: "Phoenix Wheels needs a face and a voice. Local skate culture rewards authenticity — build buzz where your people already hang out.",
    lessons: [
      {
        q: "Cheapest, highest-impact marketing for a local skate pop-up?",
        options: [
          { t: "Partner with the local skatepark, derby league & schools; post real skating on socials", correct: true,
            why: "Community + word of mouth beats paid ads for a local skate brand. Real partnerships and authentic content bring the exact crowd you want, for almost nothing." },
          { t: "Buy broad online ads to everyone", correct: false,
            why: "Broad ads waste money on people 500 miles away. Go hyper-local and partnership-driven." }
        ]
      },
      {
        q: "What earns trust in skate culture?",
        options: [
          { t: "Showing up authentically — sponsor a local event, support skaters, be real", correct: true,
            why: "Skaters smell fake instantly. Genuine support of the local scene makes Phoenix Wheels 'one of us,' which is priceless." },
          { t: "Polished corporate vibe", correct: false,
            why: "Too corporate reads as outsider. Keep it grassroots and genuine." }
        ]
      }
    ],
    capture: [
      { id: "socials", label: "Social handles to claim", type: "text", placeholder: "@phoenixwheels…" },
      { id: "partners", label: "Local partners to line up", type: "textarea", placeholder: "Skatepark, derby league, schools, shops…" },
      { id: "brand_look", label: "Brand vibe / colors", type: "text", placeholder: "Retro 8-bit, phoenix orange…" }
    ],
    pitfalls: ["Broad paid ads instead of local partnerships.", "Looking corporate in a grassroots scene."],
    wins: ["Partner with the local skate/derby community.", "Post authentic, local content."]
  },
  {
    id: "q_launchday",
    world: "w6",
    title: "BOSS: Grand Opening",
    icon: "🏁",
    points: 220,
    boss: true,
    intro: "Final boss. Every system is go — legal, permit, insurance, money, stock, brand. Plan opening day so it's a celebration, captures contacts, and proves demand.",
    lessons: [
      {
        q: "Before opening day, you should be able to check off…",
        options: [
          { t: "Structure ✔, DBA ✔, sales tax license ✔, permit/zoning ✔, insurance ✔, bank ✔, inventory ✔", correct: true,
            why: "That checklist IS the game. If all are green, you open with confidence and no nasty surprises. Missing one? Fix it before the doors open." },
          { t: "Just unlock the doors and figure out the rest live", correct: false,
            why: "Opening without permits or insurance live is the riskiest move possible. Green the checklist first." }
        ]
      },
      {
        q: "Opening day — what's the smartest thing to capture?",
        options: [
          { t: "Emails/contacts + which products people ask for + foot traffic", correct: true,
            why: "Day-one data is gold: an email list to re-invite people, demand signals for reordering, and traffic numbers for grants and your next pop-up." },
          { t: "Nothing — just enjoy the day", correct: false,
            why: "Enjoy it AND capture data. The list and demand signals you gather now fund and shape everything next." }
        ]
      }
    ],
    capture: [
      { id: "launch_date", label: "Grand opening date", type: "date" },
      { id: "launch_plan", label: "Opening day plan", type: "textarea", placeholder: "Demos, giveaways, partner appearances, hours…" },
      { id: "success_metric", label: "How you'll define a win", type: "text", placeholder: "$ sales, # contacts captured, # demos…" },
      { id: "next_step", label: "What comes after the pop-up", type: "textarea", placeholder: "Recurring pop-up, permanent space, more events…" }
    ],
    pitfalls: ["Opening with any compliance item still red.", "Not capturing contacts/demand on day one."],
    wins: ["Green the full checklist before doors open.", "Collect emails + demand data to fund what's next."]
  }
];

/* Badges awarded per world fully completed. */
const WORLD_BADGES = {
  w1: "🏛️ Founder",
  w2: "📋 Compliance Crusher",
  w3: "🛡️ Risk Ranger",
  w4: "💰 Money Master",
  w5: "📦 Stock Sergeant",
  w6: "🚀 Launch Legend"
};
