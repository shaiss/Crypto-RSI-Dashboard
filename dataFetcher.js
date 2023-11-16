const config = require('./config.json');
const axios = require('axios');

async function fetchRSIData(token) {
  const apiKey = process.env.TAAPI_SECRET;
  if (!apiKey) {
    console.error('API key is undefined. Check the TAAPI_SECRET environment variable.');
    return null;
  }

  const apiUrl = `https://api.taapi.io/rsi`;

  try {
    const params = {
      secret: apiKey,
      exchange: 'binance',
      symbol: `${token}/USDT`,
      addResultTimestamp: true,
      interval: '1h'
    };

    const response = await axios.get(apiUrl, { params });

    // Explicitly check for a successful response
    if (response.status === 200) {
      // Log response for debugging purposes
      console.log(`Response for ${token}:`, response.data);
      return response.data; // Assuming the API returns the RSI data directly
    } else {
      console.error(`Non-successful response for ${token}:`, response.status);
      return null;
    }
  } catch (error) {
    // Log more details of the axios error
    console.error(`Error fetching RSI for ${token}:`, error.message);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(error.response.data);
      console.error(error.response.status);
      console.error(error.response.headers);
    }
    return null;
  }
}


async function updateHeatmapData() {
  const heatmapData = [];
  for (const token of config.tokens) {
    const rsiData = await fetchRSIData(token);
    if (rsiData) {
      heatmapData.push({ token, rsi: rsiData.value });
    }
  }
  return heatmapData; // Return the data instead of logging it.
}

module.exports = { fetchRSIData, updateHeatmapData };

