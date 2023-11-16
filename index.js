const express = require('express');
const app = express();
const path = require('path');
const { updateHeatmapData } = require('./dataFetcher');
const config = require('./config.json');

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// New endpoint to provide the heatmap data to the frontend
app.get('/api/heatmap-data', async (req, res) => {
  try {
    const heatmapData = await updateHeatmapData();
    res.json(heatmapData);
  } catch (error) {
    res.status(500).send('Error fetching heatmap data');
  }
});

setInterval(async () => {
  // Save the heatmap data for the endpoint to serve
  global.heatmapData = await updateHeatmapData();
}, config.updateInterval);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
