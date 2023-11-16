// Function to fetch heatmap data from the server
async function fetchHeatmapData() {
  try {
    const response = await fetch('/api/heatmap-data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
  }
}

// Function to get the color for a given RSI value
function getColorForRSI(rsi) {
  if (rsi < 30) {
    return 'rgba(0, 255, 0, 0.5)'; // Green with some transparency
  } else if (rsi >= 30 && rsi <= 70) {
    return 'rgba(0, 0, 255, 0.5)'; // Blue with some transparency
  } else {
    return 'rgba(255, 0, 0, 0.5)'; // Red with some transparency
  }
}

// Function to initialize the chart with the fetched data
async function initializeChart() {
  const heatmapData = await fetchHeatmapData();
  if (!heatmapData) {
    console.error('Failed to initialize chart: No data available');
    return;
  }
  const ctx = document.getElementById('heatmapCanvas').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bubble', 
    data: {
      datasets: heatmapData.map((item, index) => ({
        label: item.token,
        data: [{
          x: index, // Use index as the x value
          y: item.rsi,
          r: 5
        }],
        backgroundColor: getColorForRSI(item.rsi),
      }))
    },
    options: {
      scales: {
        x: {
          // Adjust x-axis to be more meaningful for your use case
          type: 'linear',
          position: 'bottom'
        },
        y: {
          title: {
            display: true,
            text: 'RSI'
          }
        }
      }
    }
  });
  return chart;
}

// Function to update the chart with new data
async function updateChart(chart) {
  const newData = await fetchHeatmapData();
  if (newData) {
    chart.data.datasets = newData.map((item, index) => ({
      label: item.token,
      data: [{
        x: index, // Use index as the x value
        y: item.rsi,
        r: 5
      }],
      backgroundColor: getColorForRSI(item.rsi),
    }));
    chart.update();
  }
}


// Initialize the chart and set up periodic updates
async function setupChart() {
  const chart = await initializeChart(); // Assuming initializeChart() returns a Chart.js instance
  if (chart) {
    setInterval(() => updateChart(chart), 20000); // Update every 20 seconds
  }
}

// Call the setup function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  setupChart();
});
