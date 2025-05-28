// graphs.js (D3 v3)
// -------------------------------------------
const d3 = window.d3;

const maxPoints = 50;
const margin = { top: 10, right: 20, bottom: 30, left: 40 };
const width  = 340;
const height = 180;

const data = [];
let polling = null;

const svg = d3.select('#graphs-content')
  .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// Escalas y line generator (v3)
const x = d3.time.scale().range([0, width]);
const y = d3.scale.linear().range([height, 0]);
const line = d3.svg.line()
  .x(function(d) { return x(d.time); })
  .y(function(d) { return y(d.light); })
  // .interpolate("monotone") // opcional

// Ejes (v3)
const xAxis = d3.svg.axis().scale(x).orient('bottom').ticks(5).tickFormat(d3.time.format('%H:%M:%S'));
const yAxis = d3.svg.axis().scale(y).orient('left');

svg.append('g')
  .attr('class','x-axis')
  .attr('transform','translate(0,' + height + ')');

svg.append('g')
  .attr('class','y-axis');

const path = svg.append('path')
  .attr('class','line')
  .attr('fill','none')
  .attr('stroke','#00ffcc')
  .attr('stroke-width',2);

async function fetchAndGraph() {
  try {
    const res = await fetch('/latest');
    if (!res.ok) return;
    const d = await res.json();

    data.push({ time: new Date(), light: d.light_level });
    if (data.length > maxPoints) data.shift();

    x.domain(d3.extent(data, function(d) { return d.time; }));
    y.domain([0, d3.max(data, function(d) { return d.light; }) * 1.1]);

    // Redibuja ejes
    svg.select('.x-axis').call(xAxis);
    svg.select('.y-axis').call(yAxis);

    // Redibuja línea
    path.datum(data).attr('d', line);

  } catch (err) {
    console.error('Error en gráfico:', err);
  }
}

const graphsBtn   = document.getElementById('graphs-btn');
const graphsPanel = document.getElementById('graphs-panel');

graphsBtn.addEventListener('click', function() {
  graphsPanel.classList.toggle('show');

  if (graphsPanel.classList.contains('show')) {
    fetchAndGraph();
    polling = setInterval(fetchAndGraph, 5000);
  } else {
    clearInterval(polling);
  }
});
