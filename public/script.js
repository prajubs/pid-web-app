// public/script.js
const pidForm = document.getElementById('pid-form');
const tempEl = document.getElementById('temp');
const outputEl = document.getElementById('output');
const ctx = document.getElementById('pidChart').getContext('2d');

const tempData = [];
const outputData = [];
const labels = [];

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: tempData,
        borderColor: 'orange',
        fill: false,
      },
      {
        label: 'PID Output (%)',
        data: outputData,
        borderColor: 'green',
        fill: false,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: 'Time' } },
      y: { title: { display: true, text: 'Value' }, min: 0 }
    }
  }
});

if (pidForm) {
  pidForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(pidForm);
    const data = Object.fromEntries(formData);
    const response = await fetch('/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    alert(result.message);
  });
}

async function fetchOutput() {
  const res = await fetch('/latest-output');
  const data = await res.json();
  tempEl.textContent = data.temperature.toFixed(2);
  outputEl.textContent = data.output.toFixed(2);

  const now = new Date().toLocaleTimeString();
  labels.push(now);
  tempData.push(data.temperature);
  outputData.push(data.output);

  if (labels.length > 20) {
    labels.shift();
    tempData.shift();
    outputData.shift();
  }
  chart.update();
}

if (tempEl && outputEl) {
  setInterval(fetchOutput, 2000);
}
app.get('/export-csv', checkAuth, (req, res) => {
    db.all(`SELECT * FROM pid_outputs ORDER BY timestamp ASC`, (err, rows) => {
      if (err) return res.status(500).send('Error exporting');
  
      let csv = "timestamp,temperature,output\n";
      rows.forEach(r => {
        csv += `${r.timestamp},${r.temperature},${r.output}\n`;
      });
  
      res.header('Content-Type', 'text/csv');
      res.attachment('pid_output.csv');
      res.send(csv);
    });
  });
  
