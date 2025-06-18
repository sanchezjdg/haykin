// Configuración global
const apiKey = '';
const defaultLat = 11.0041; // Barranquilla
const defaultLon = -74.8070; // Barranquilla
const UPDATE_INTERVAL = 60 * 1000; // 1 minuto en ms

class WeatherPanel {
    constructor() {
        this.panel = null;
        this.currentLat = defaultLat;
        this.currentLon = defaultLon;
        this.updateInterval = null;
        this.lastUpdate = 0;
    }

    formatTemperature(temp) {
        return temp ? parseFloat(temp).toFixed(1) : 'N/A';
    }

    formatWeatherData(data) {
        if (!data?.main) {
            throw new Error('Datos del clima inválidos');
        }

        const temp = this.formatTemperature(data.main.temp);
        const feels = this.formatTemperature(data.main.feels_like);
        const tempMin = this.formatTemperature(data.main.temp_min);
        const tempMax = this.formatTemperature(data.main.temp_max);
        
        const pressure = data.main.pressure || 'N/A';
        const humidity = data.main.humidity || 'N/A';
        const seaLevel = data.main.sea_level || 'N/A';
        const grndLevel = data.main.grnd_level || 'N/A';
        
        const visibility = data.visibility ? (data.visibility / 1000).toFixed(1) + ' km' : 'N/A';
        const windSpeed = data.wind?.speed ? data.wind.speed + ' m/s' : 'N/A';
        const windDeg = data.wind?.deg ? data.wind.deg + '°' : 'N/A';
        const clouds = data.clouds?.all ? data.clouds.all + '%' : 'N/A';
        
        const cityName = data.name || 'Ubicación actual';
        const country = data.sys?.country ? data.sys.country : '';
        const description = data.weather?.[0]?.description
            ? data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1)
            : '';

        // Conversión de timestamp Unix a hora local
        const formatTime = (timestamp) => {
            if (!timestamp) return 'N/A';
            return new Date(timestamp * 1000).toLocaleTimeString();
        };

        const sunrise = formatTime(data.sys?.sunrise);
        const sunset = formatTime(data.sys?.sunset);

        // Debug: mostrar datos crudos en consola
        console.log('Datos del clima recibidos:', {
            temp, feels, tempMin, tempMax,
            pressure, humidity, seaLevel, grndLevel,
            visibility, windSpeed, windDeg, clouds,
            sunrise, sunset
        });

        return `
<b>${cityName}${country ? ', ' + country : ''}</b><br>
${description}<br>
Temperatura: <b>${temp}°C</b> (Sensación: ${feels}°C)<br>
Presión: ${pressure} hPa<br>
Humedad: ${humidity}%<br>
Nivel mar: ${seaLevel} hPa / Nivel suelo: ${grndLevel} hPa<br>
Visibilidad: ${visibility}<br>
Viento: ${windSpeed} (${windDeg})<br>
Nubes: ${clouds}<br>
Amanecer: ${sunrise}<br>
Atardecer: ${sunset}
`;
    }

    async fetchWeather(lat = this.currentLat, lon = this.currentLon, force = false) {
        const now = Date.now();
        if (!force && now - this.lastUpdate < UPDATE_INTERVAL) {
            console.log('Esperando para actualizar, tiempo restante:', 
                Math.round((UPDATE_INTERVAL - (now - this.lastUpdate))/1000), 'segundos');
            return;
        }

        try {
            if (!this.panel) {
                console.error('Panel del clima no inicializado');
                return;
            }

            // Validar coordenadas
            if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
                console.warn('Coordenadas inválidas, usando valores por defecto');
                lat = defaultLat;
                lon = defaultLon;
            }

            this.currentLat = lat;
            this.currentLon = lon;

            console.log('Obteniendo clima para:', lat, lon);
            this.panel.innerHTML = 'Actualizando...';

            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=es`
            );

            if (!response.ok) {
                throw new Error(`Error en API del clima: ${response.status}`);
            }

            const data = await response.json();
            this.lastUpdate = now;
            
            // Debug: mostrar respuesta cruda
            console.log('Respuesta cruda de la API:', data);
            
            this.panel.innerHTML = this.formatWeatherData(data);

        } catch (err) {
            console.error('Error al obtener el clima:', err);
            this.panel.innerHTML = 'Error al cargar clima';
        }
    }

    initialize() {
        this.panel = document.getElementById('weather-panel');
        if (!this.panel) {
            console.error('No se encontró el elemento weather-panel');
            return;
        }

        // Limpiar intervalo existente si lo hay
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Primera carga forzada
        this.fetchWeather(defaultLat, defaultLon, true);

        // Configurar actualización automática
        this.updateInterval = setInterval(() => {
            this.fetchWeather(this.currentLat, this.currentLon, true);
        }, UPDATE_INTERVAL);

        // Exponer método de actualización seguro
        window.updateWeather = (lat, lon) => {
            this.fetchWeather(lat, lon, true);
        };
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const weatherPanel = new WeatherPanel();
    weatherPanel.initialize();
});
