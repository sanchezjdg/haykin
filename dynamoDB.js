// dynamoDB.js
// -----------------------------
// Connects to DynamoDB, scans the "Positions" table,
// converts latitude/longitude to UTM coordinates,
// parses sensor data, and returns the most recent record.
// Uses AWS SDK v3, proj4 for reprojection.

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const proj4 = require('proj4');
require('dotenv').config();

// Coordinate reference systems
const WGS84 = 'EPSG:4326';      // Geographic coords (lat, lon)
const UTM18N = 'EPSG:32618';    // UTM Zone 18N (Barranquilla)

// Global offset for Potree coordinate alignment
const METADATA_OFFSET = [
  521755.49180625769, // Easting origin (m)
  1214558.2817465025,  // Northing origin (m)
  23.819908644322823 // Z origin (m)
];

// Initialize DynamoDB client
const dbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Test connection on startup
(async () => {
  try {
    await dbClient.send(new ScanCommand({ TableName: 'Positions', Limit: 1 }));
    console.log('✅ DynamoDB connection successful');
  } catch (err) {
    console.error('❌ DynamoDB connection error:', err);
  }
})();

/**
 * Fetches and returns the latest position record from DynamoDB.
 * Reprojects to UTM, applies offset to align with Potree world.
 * Parses additional sensor fields.
 * @returns {Object|null} Latest { latitude, longitude, altitude, x, y, z, timestamp, mag_x, mag_y, mag_z, light_level, pressure, sound_level } or null
 */
async function getLatestPosition() {
  try {
    const result = await dbClient.send(
      new ScanCommand({ TableName: 'Positions' })
    );

    if (!result.Items?.length) {
      console.log('ℹ️ No records found in Positions table');
      return null;
    }

    const parsed = result.Items
      .map(item => {
        try {
          const p = item.payload.M;
          const ts = Number(p.timestamp.S);
          const lat = Number(p.latitude.S);
          const lon = Number(p.longitude.S);
          const alt = Number(p.altitude.S);

          // Reproject to UTM Zone 18N
          const [easting, northing] = proj4(WGS84, UTM18N, [lon, lat]);
          const x = easting - METADATA_OFFSET[0];
          const y = northing - METADATA_OFFSET[1];
          const z = alt - METADATA_OFFSET[2];

          // Sensor fields
          const mag_x = Number(p.mag_x?.S ?? NaN);
          const mag_y = Number(p.mag_y?.S ?? NaN);
          const mag_z = Number(p.mag_z?.S ?? NaN);
          const light_level = Number(p.light_level?.S ?? NaN);
          const pressure = Number(p.pressure?.S ?? NaN);
          const sound_level = Number(p.sound_level?.S ?? NaN);

          return {
            latitude: lat,
            longitude: lon,
            altitude: alt,
            x,
            y,
            z,
            timestamp: ts,
            mag_x,
            mag_y,
            mag_z,
            light_level,
            pressure,
            sound_level
          };
        } catch (e) {
          console.error('⚠️ Error parsing item:', e);
          return null;
        }
      })
      .filter(rec => rec && !Number.isNaN(rec.timestamp));

    if (!parsed.length) {
      console.log('⚠️ No valid records after parsing');
      return null;
    }

    const latest = parsed.sort((a, b) => b.timestamp - a.timestamp)[0];
    console.log('📌 Latest record:', latest);
    return latest;
  } catch (err) {
    console.error('❌ Error fetching latest position:', err);
    return null;
  }
}

module.exports = { getLatestPosition };