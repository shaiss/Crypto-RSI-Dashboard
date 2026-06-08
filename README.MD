# Phoenix Wheels: Launch Quest 🔥🛞

An **8-bit retro game** that walks through launching **Phoenix Wheels** — an
everything-wheels pop-up (skateboards, scooters, derby skates & rollerblades;
no bikes) in the 19460 / Royersford–Phoenixville, PA area, run as a nonprofit
under the Perednik Foundation.

It gamifies the real launch roadmap — legal structure, permits, sales tax,
insurance, banking, grants, inventory, and the grand opening — into six
"worlds" of quests. Each quest teaches the **common rookie mistakes** through a
**do this / don't do that** card game, then captures the founder's **real plan**
(dates, vendors, budgets, grant targets). Finishing builds a printable,
exportable **launch roadmap**.

### Play it

```sh
npm install
npm start
```

Then open **`http://localhost:3000/game/`**.

Or, because it's a fully self-contained static app, just open
`public/game/index.html` directly in any browser — it works offline.

### How it works

- **Six worlds** (`public/game/quests.js`): Foundation, Permits, Insurance,
  Funding, Inventory, Launch. All content lives here and is easy to edit.
- **Do / Don't lessons** teach the common mistakes; smart answers earn XP.
- **Real-plan capture** saves the founder's answers to the browser
  (localStorage) — private, no account, works offline.
- **XP, levels & badges** track progress; clear a world to earn its badge.
- **Roadmap** view + **JSON export** + **print/PDF** to take the plan offline.
- Engine in `public/game/game.js`, retro styling in `public/game/style.css`.

> ⚠️ The game is an educational planning aid — **not** legal, tax, or insurance
> advice. Verify every item with the relevant PA / Montgomery County / borough
> office and your own professionals.

---

# Crypto Heatmap Dashboard

> Note: this repository also still contains the original Crypto Heatmap
> Dashboard MVP described below. The game above is served at `/game/`.

## Description

Crypto Heatmap Dashboard is an interactive web application designed to visualize cryptocurrency market data in real-time. It leverages a bubble chart to display the Relative Strength Index (RSI) of various cryptocurrencies, providing an intuitive and dynamic way to monitor market trends.

## Features

- **Real-Time Data Visualization**: Display the RSI of different cryptocurrencies in a bubble chart format.
- **Automatic Data Refresh**: The chart updates every 20 seconds to reflect the most recent market data.
- **Interactive UI**: Easy to navigate interface with clear visualization.
- **Customizable Chart**: Bubble chart with customizable options for better data representation.

## Getting Started

### Prerequisites

- Node.js (version 12 or higher)
- npm (Node Package Manager)

### Installation

1. **Clone the Repository**

   ```sh
   git clone [repository URL]
   cd [repository directory]
   ```

2. **Install Dependencies**

   Navigate to the project directory and run:

   ```sh
   npm install
   ```

3. **Start the Server**

   ```sh
   npm start
   ```

   This will start the server on `localhost:3000` (or another port if configured).

### Usage

Once the server is running, open your web browser and go to `http://localhost:3000`. You'll see the Crypto Heatmap Dashboard displaying the live data.

## How It Works

- **Data Fetching**: `dataFetcher.js` periodically fetches market data from the crypto API.
- **Server-Side Processing**: `index.js` processes the data and prepares it for the frontend.
- **Frontend Visualization**: `public/main.js` and `public/index.html` handle the rendering of the bubble chart.

## Configuration

- **Config File**: `config.json` in the project root directory allows configuration of tokens and update intervals.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Your Name - [shai@kalmansforge.com]
