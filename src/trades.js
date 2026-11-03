// Content for the per-trade quote template pages (/quote-template/:slug). Example prices are typical
// US figures and are labeled as examples on the page.
export const TRADES = [
  {
    slug: "plumber", name: "Plumbing", trade: "plumber", who: "plumbers",
    intro: "Most plumbing jobs are won by the first clear, itemized quote to reach the customer. Here's what a good plumbing quote includes, a worked example, and a free generator that writes one from your notes.",
    includes: [
      "Labor broken into steps (diagnose, remove, install, test), not one lump sum",
      "Parts listed separately: valves, supply lines, fittings, fixtures",
      "Who supplies the fixture: customer-supplied taps and toilets change your price",
      "Access assumptions: crawlspace, finished ceilings, shutoff condition",
      "Permit and inspection costs for water heaters and re-pipes",
      "Disposal of old fixtures",
    ],
    example: {
      title: "Kitchen faucet and shutoff valve replacement", rate: 95,
      items: [
        ["Diagnose leak, remove old faucet and seized shutoff valves", "labor", 1, "hr", 95],
        ["Install two 1/4-turn shutoff valves and braided supply lines", "labor", 1, "hr", 95],
        ["Install customer-supplied faucet, test and clean up", "labor", 0.5, "hr", 95],
        ["1/4-turn angle stop valves", "materials", 2, "each", 18.5],
        ["Braided supply lines, 20 in", "materials", 2, "each", 11],
      ],
      exclusions: ["Countertop or cabinet repair", "Drain line work", "Repairs to walls if pipes are corroded beyond the valve"],
    },
    faq: [
      ["Should a plumbing quote include a call-out fee?", "If you charge one, list it as its own line so the customer sees it up front. Many plumbers waive it when the quote is accepted. Say so in the terms if you do."],
      ["How do I price a water heater replacement?", "Quote the unit, expansion tank, fittings, gas or electrical connection, haul-away and permit as separate lines, then add labor. Customers compare totals, but itemizing shows why yours is worth it."],
    ],
  },
  {
    slug: "electrician", name: "Electrical", trade: "electrician", who: "electricians",
    intro: "Electrical work needs quotes that are precise about scope, code and permits, because that's where disputes start. Here's a template, a real example, and a generator that turns your notes into a finished quote.",
    includes: [
      "Each device or circuit as its own line (outlets, GFCIs, fixtures, new runs)",
      "Wire runs with approximate length and gauge for new circuits",
      "Panel capacity assumptions and what happens if it's full",
      "Permit and inspection fees, and who books the inspection",
      "Patching and painting after fishing wires: included or not",
      "Customer-supplied fixtures and chargers",
    ],
    example: {
      title: "Level 2 EV charger install (customer-supplied charger)", rate: 120,
      items: [
        ["Run 40A circuit from panel to garage, ~35 ft", "labor", 2.5, "hr", 120],
        ["Mount and connect customer-supplied charger, test", "labor", 1, "hr", 120],
        ["6/2 NM-B cable", "materials", 40, "ft", 3.1],
        ["40A 2-pole breaker", "materials", 1, "each", 28],
        ["Permit and inspection", "fee", 1, "each", 150],
      ],
      exclusions: ["Panel upgrade if capacity is insufficient", "Drywall patching and painting", "Utility service upgrades"],
    },
    faq: [
      ["Should I include the permit in my electrical quote?", "Yes. List it as its own line. It shows you work to code, and customers trust a quote that doesn't hide it."],
      ["What if I find a problem after starting?", "Put it in the assumptions (e.g. 'existing wiring in serviceable condition') so unexpected repairs become a change order, not an argument."],
    ],
  },
  {
    slug: "painter", name: "Painting", trade: "painter", who: "painters",
    intro: "Painting quotes are lost on vagueness: which surfaces, how many coats, who moves furniture. Here's a template that answers those questions, an example, and a free generator.",
    includes: [
      "Each room or surface with square footage",
      "Number of coats, and primer where needed",
      "Prep work: patching, sanding, caulking, pressure washing",
      "Paint brand/quality and who supplies it",
      "Trim, doors, ceilings: included or excluded, explicitly",
      "Furniture moving and protection",
    ],
    example: {
      title: "Living room repaint, 16×20 ft, 9 ft ceilings", rate: 55,
      items: [
        ["Prep: patch nail holes, sand, caulk, protect floors", "labor", 3, "hr", 55],
        ["Walls: two coats", "labor", 8, "hr", 55],
        ["Ceiling: one coat flat white", "labor", 3, "hr", 55],
        ["Interior acrylic paint, walls", "materials", 3, "gal", 48],
        ["Ceiling paint", "materials", 2, "gal", 32],
        ["Patching compound, caulk, tape, plastic", "materials", 1, "lot", 35],
      ],
      exclusions: ["Trim and doors", "Moving heavy furniture", "Repair of water-damaged drywall"],
    },
    faq: [
      ["Should I quote painting by the hour or by the room?", "Customers like a fixed total, but build it from hours plus materials so your price holds up. A quote that shows prep separately also explains why you're not the cheapest."],
      ["Do I include paint in the quote?", "Yes. List it with quantities and quality. If the customer supplies paint, say so in the assumptions."],
    ],
  },
  {
    slug: "handyman", name: "Handyman", trade: "handyman", who: "handymen",
    intro: "Handyman jobs are lists of small tasks, and it's easy to underquote when they're lumped together. Itemize each task and it's clear what's included. Template, example and generator below.",
    includes: [
      "One line per task, so the customer can see what each costs",
      "Customer-supplied items (TV mounts, shelves, fixtures)",
      "Minimum charge or trip fee, if you have one",
      "Materials you pick up, with a markup",
      "Wall type assumptions for mounting (drywall, plaster, brick)",
    ],
    example: {
      title: "Weekend task list: TV mount, shelves, door, caulking", rate: 75,
      items: [
        ["Mount 65 in TV on customer-supplied mount, hide cables in-wall kit", "labor", 1.5, "hr", 75],
        ["Hang 3 floating shelves", "labor", 1, "hr", 75],
        ["Plane and adjust sticking bedroom door", "labor", 0.75, "hr", 75],
        ["Remove and re-caulk tub surround", "labor", 1.25, "hr", 75],
        ["In-wall cable kit", "materials", 1, "each", 45],
        ["Silicone caulk, anchors, hardware", "materials", 1, "lot", 25],
      ],
      exclusions: ["Electrical work beyond low-voltage cable kits", "Repairs to damaged drywall"],
    },
    faq: [
      ["Should handyman quotes have a minimum charge?", "Most do. Show it as a line or in the terms so small jobs are still worth the drive."],
      ["How do I stop 'while you're here' extras?", "List exactly what's included, and add an exclusion like 'additional tasks quoted separately'. QuoteSmith adds exclusions to every quote for this reason."],
    ],
  },
  {
    slug: "hvac", name: "HVAC", trade: "HVAC technician", who: "HVAC technicians",
    intro: "HVAC customers usually call when something's broken, and the first clear quote wins. Here's a repair quote template, an example, and a generator that drafts one on site from your notes.",
    includes: [
      "Diagnostic fee, and whether it's credited against the repair",
      "Each part replaced, with specs (e.g. capacitor MFD rating)",
      "Refrigerant by the pound, if added",
      "Warranty on parts and labor",
      "What wasn't checked or isn't covered (ductwork, electrical upstream)",
    ],
    example: {
      title: "AC not cooling: capacitor replacement and coil clean", rate: 115,
      items: [
        ["Diagnostic visit", "fee", 1, "each", 89],
        ["Replace dual run capacitor, test amp draw", "labor", 0.75, "hr", 115],
        ["Clean condenser coil", "labor", 1, "hr", 115],
        ["45/5 MFD dual run capacitor", "materials", 1, "each", 38],
        ["Coil cleaner", "materials", 1, "each", 14],
      ],
      exclusions: ["Refrigerant leak search and recharge", "Ductwork", "Thermostat replacement"],
    },
    faq: [
      ["Should HVAC quotes list refrigerant separately?", "Yes, priced per pound. It's one of the most questioned charges, so showing it plainly builds trust."],
      ["Do I include a warranty?", "State it in the terms (e.g. 1 year parts, 90 days labor). It's a selling point, so make it visible."],
    ],
  },
  {
    slug: "roofer", name: "Roofing", trade: "roofer", who: "roofers",
    intro: "Roofing repairs carry hidden-damage risk, so a good quote is explicit about what happens when you find rotten decking. Template, example and generator below.",
    includes: [
      "Area in squares or square feet, and the shingle type to match",
      "Decking replacement priced per sheet, as a known unknown",
      "Underlayment, flashing, boots and vents as separate lines",
      "Tear-off and disposal",
      "Weather and access assumptions (pitch, stories, lift or harness)",
    ],
    example: {
      title: "Leak repair over back bedroom, ~40 sq ft", rate: 85,
      items: [
        ["Remove damaged shingles and soft decking", "labor", 2, "hr", 85],
        ["Install decking, underlayment, shingles to match, new pipe boot", "labor", 4, "hr", 85],
        ["7/16 OSB decking sheet", "materials", 1, "each", 32],
        ["Synthetic underlayment", "materials", 1, "roll", 95],
        ["Architectural shingles (bundle)", "materials", 2, "bundle", 42],
        ["Pipe boot flashing", "materials", 1, "each", 22],
        ["Debris disposal", "fee", 1, "each", 75],
      ],
      exclusions: ["Interior ceiling repair", "Additional decking beyond one sheet (priced per sheet)", "Gutter repair"],
    },
    faq: [
      ["How do I quote decking I can't see yet?", "Include one sheet in the price and state a per-sheet price for anything extra in the assumptions. Customers accept this when it's written down before you start."],
      ["Should roofing quotes require a deposit?", "Commonly 30–50% to cover materials. Set your deposit in QuoteSmith and it appears on the quote with a pay button after acceptance."],
    ],
  },
  {
    slug: "landscaper", name: "Landscaping", trade: "landscaper", who: "landscapers",
    intro: "Landscaping quotes mix labor, plants and bulk materials, and customers want to see each. Here's a template, an example, and a generator that itemizes it for you.",
    includes: [
      "Removal and haul-away of existing plants or debris",
      "Each plant with size (e.g. 3 gal) and quantity",
      "Bulk materials by the yard: mulch, soil, rock",
      "Edging, fabric and irrigation adjustments",
      "Plant warranty and watering responsibilities",
    ],
    example: {
      title: "Front bed refresh: remove shrubs, new boxwoods, mulch", rate: 60,
      items: [
        ["Remove 6 overgrown shrubs and roots, haul away", "labor", 5, "hr", 60],
        ["Plant 8 boxwoods, install steel edging", "labor", 4, "hr", 60],
        ["Spread mulch", "labor", 2, "hr", 60],
        ["Boxwood, 3 gal", "materials", 8, "each", 28],
        ["Steel edging, 40 ft", "materials", 1, "lot", 120],
        ["Hardwood mulch, delivered", "materials", 4, "yd", 45],
        ["Green waste disposal", "fee", 1, "each", 60],
      ],
      exclusions: ["Irrigation changes", "Plant replacement due to customer under-watering"],
    },
    faq: [
      ["Do landscaping quotes include a plant warranty?", "Many offer 30–90 days, conditional on watering. State it in the terms so it's clear."],
      ["How should I price mulch and soil?", "By the cubic yard, with delivery as part of the line or separate. QuoteSmith keeps your usual prices in a price book so every quote matches."],
    ],
  },
  {
    slug: "cleaner", name: "Cleaning", trade: "cleaner", who: "cleaning businesses",
    intro: "Cleaning quotes win when the customer can see exactly what's being cleaned. Here's a deep-clean template, an example, and a generator that writes it from a quick walkthrough.",
    includes: [
      "Size of the space and number of rooms/bathrooms",
      "Crew size and hours",
      "Add-ons as separate lines: inside oven, fridge, windows, cabinets",
      "Supplies: yours or the customer's",
      "What's excluded: biohazards, exterior windows, heavy moving",
    ],
    example: {
      title: "Move-out deep clean, 2 bed / 1 bath, ~900 sq ft", rate: 45,
      items: [
        ["Deep clean: kitchen, bathroom, bedrooms, floors (2 cleaners)", "labor", 8, "hr", 45],
        ["Inside oven and fridge", "labor", 1.5, "hr", 45],
        ["Inside cabinets and interior windows", "labor", 1.5, "hr", 45],
        ["Cleaning supplies", "materials", 1, "lot", 30],
      ],
      exclusions: ["Exterior windows", "Carpet shampooing", "Removal of items left behind"],
    },
    faq: [
      ["Should I quote cleaning by the hour or a flat rate?", "Customers prefer a flat total. Build it from crew-hours so you know it's profitable, and list add-ons separately so they can choose."],
      ["How do I handle a move-out clean that's dirtier than expected?", "Add an assumption like 'priced for normal wear; heavy soiling billed hourly'. It's on the quote before you start."],
    ],
  },
];

export const tradeBySlug = Object.fromEntries(TRADES.map((t) => [t.slug, t]));
