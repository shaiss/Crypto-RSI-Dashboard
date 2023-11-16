# Project Name: Crypto Heatmap Dashboard

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
