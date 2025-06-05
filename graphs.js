// graphs.js (D3 v3)
// -------------------------------------------
const d3 = window.d3;

const maxPoints = 50;
const margin = { top: 10, right: 20, bottom: 30, left: 40 };
const width = 300;
const height = 180;

const data = [];
let polling = null;

// Ajustar el ancho del panel para tres gráficas
document.querySelector('#graphs-panel').style.width = '1000px';

// Crear contenedor flexible para las gráficas
const graphsContent = d3.select('#graphs-content')
    .style('display', 'flex')
    .style('flex-wrap', 'wrap')
    .style('gap', '10px')
    .style('justify-content', 'space-between');

// Escalas para cada gráfica
const xLight = d3.time.scale().range([0, width]);
const yLight = d3.scale.linear().range([height, 0]);
const xSound = d3.time.scale().range([0, width]);
const ySound = d3.scale.linear().range([height, 0]);
const xPressure = d3.time.scale().range([0, width]);
const yPressure = d3.scale.linear().range([height, 0]);

// Function to create grid lines
function make_x_grid() {
    return d3.svg.axis()
        .scale(xLight)
        .orient("bottom")
        .ticks(5);
}

function make_y_grid() {
    return d3.svg.axis()
        .scale(yLight)
        .orient("left")
        .ticks(5);
}

// Panel de luz
const lightPanel = graphsContent.append('div')
    .style('flex', '1')
    .style('min-width', '300px');
lightPanel.append('h3')
    .style('margin', '0 0 5px 0')
    .style('color', '#fff')
    .text('Light Level (lx)');
const svgLight = lightPanel.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// Panel de sonido
const soundPanel = graphsContent.append('div')
    .style('flex', '1')
    .style('min-width', '300px');
soundPanel.append('h3')
    .style('margin', '0 0 5px 0')
    .style('color', '#fff')
    .text('Sound Level (dB)');
const svgSound = soundPanel.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// Panel de presión
const pressurePanel = graphsContent.append('div')
    .style('flex', '1')
    .style('min-width', '300px');
pressurePanel.append('h3')
    .style('margin', '0 0 5px 0')
    .style('color', '#fff')
    .text('Pressure (hPa)');
const svgPressure = pressurePanel.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

// Generadores de líneas
const lineLight = d3.svg.line()
    .x(d => xLight(d.time))
    .y(d => yLight(d.light));
const lineSound = d3.svg.line()
    .x(d => xSound(d.time))
    .y(d => ySound(d.sound));
const linePressure = d3.svg.line()
    .x(d => xPressure(d.time))
    .y(d => yPressure(d.pressure));

// Ejes
const xAxis = d3.svg.axis().scale(xLight).orient('bottom').ticks(5).tickFormat(d3.time.format('%H:%M:%S'));
const yAxisLight = d3.svg.axis().scale(yLight).orient('left').ticks(5);
const yAxisSound = d3.svg.axis().scale(ySound).orient('left').ticks(5);
const yAxisPressure = d3.svg.axis().scale(yPressure).orient('left').ticks(5);

// Agregar ejes y grids a cada gráfica
[svgLight, svgSound, svgPressure].forEach(svg => {
    svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')');
    svg.append('g')
        .attr('class', 'y axis');
    svg.append('g')
        .attr('class', 'grid')
        .attr('transform', 'translate(0,' + height + ')')
        .style('stroke-dasharray', '2,2');
    svg.append('g')
        .attr('class', 'grid')
        .style('stroke-dasharray', '2,2');
});

// Paths para cada gráfica
const pathLight = svgLight.append('path')
    .attr('class', 'line')
    .attr('fill', 'none')
    .attr('stroke', '#00ffcc')
    .attr('stroke-width', 2);

const pathSound = svgSound.append('path')
    .attr('class', 'line')
    .attr('fill', 'none')
    .attr('stroke', '#ff3366')
    .attr('stroke-width', 2);

const pathPressure = svgPressure.append('path')
    .attr('class', 'line')
    .attr('fill', 'none')
    .attr('stroke', '#ffcc00')
    .attr('stroke-width', 2);

async function fetchAndGraph() {
    try {
        const res = await fetch('/latest');
        if (!res.ok) return;
        const d = await res.json();

        data.push({
            time: new Date(),
            light: d.light_level,
            sound: d.sound_level,
            pressure: d.pressure
        });

        if (data.length > maxPoints) data.shift();

        // Actualizar dominios
        const timeExtent = d3.extent(data, d => d.time);
        [xLight, xSound, xPressure].forEach(x => x.domain(timeExtent));

        // Establecer dominios con valores mínimos sensibles
        yLight.domain([0, Math.max(10, d3.max(data, d => d.light) * 1.1)]);
        ySound.domain([0, Math.max(100, d3.max(data, d => d.sound) * 1.1)]);
        // Para la presión, usamos un rango más específico alrededor de la presión atmosférica normal
        const pressureMin = Math.min(900, d3.min(data, d => d.pressure) * 0.99);
        const pressureMax = Math.max(1100, d3.max(data, d => d.pressure) * 1.01);
        yPressure.domain([pressureMin, pressureMax]);

        // Actualizar ejes y grids
        svgLight.select('.x.axis').call(xAxis);
        svgLight.select('.y.axis').call(yAxisLight);
        svgLight.selectAll('.grid')
            .call(make_x_grid()
                .tickSize(-height, 0, 0)
                .tickFormat(''));

        svgSound.select('.x.axis').call(xAxis.scale(xSound));
        svgSound.select('.y.axis').call(yAxisSound);
        svgSound.selectAll('.grid')
            .call(make_y_grid()
                .tickSize(-width, 0, 0)
                .tickFormat(''));

        svgPressure.select('.x.axis').call(xAxis.scale(xPressure));
        svgPressure.select('.y.axis').call(yAxisPressure);
        svgPressure.selectAll('.grid')
            .call(make_y_grid()
                .tickSize(-width, 0, 0)
                .tickFormat(''));

        // Actualizar líneas
        pathLight.datum(data).attr('d', lineLight);
        pathSound.datum(data).attr('d', lineSound);
        pathPressure.datum(data).attr('d', linePressure);

    } catch (err) {
        console.error('Error en gráfico:', err);
    }
}

const graphsBtn = document.getElementById('graphs-btn');
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