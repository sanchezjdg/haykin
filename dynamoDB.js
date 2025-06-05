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
    await dbClient.send(new ScanCommand({ TableName: 'locations', Limit: 1 }));
    console.log('✅ DynamoDB connection successful');
  } catch (err) {
    console.error('❌ DynamoDB connection error:', err);
  }
})();

/**
 * Gets all unique phone numbers from the Positions table
 * @returns {Array<string>} Array of phone numbers
 */
async function getAllPhones() {
  try {    const result = await dbClient.send(
      new ScanCommand({ 
        TableName: 'locations',
        ProjectionExpression: 'deviceId'
      })
    );

    if (!result.Items?.length) return [];

    // Solo deviceid como identificador
    const phones = [...new Set(result.Items.map(item => item.deviceId?.S).filter(Boolean))];
    console.log('📱 Found phones:', phones);
    return phones;
  } catch (err) {
    console.error('❌ Error fetching phones:', err);
    return [];
  }
}

/**
 * Fetches and returns the latest position record for a specific device or all devices
 * @param {string} [deviceid] Optional deviceId to filter by
 * @returns {Object|Array|null} Latest position data
 */
async function getLatestPosition(deviceId = null) {
  try {
    const scanParams = {
      TableName: 'locations',
    };
    
    if (deviceId) {
      scanParams.FilterExpression = 'deviceId = :deviceId';
      scanParams.ExpressionAttributeValues = {
        ':deviceId': { S: deviceId }
      };
    }

    const result = await dbClient.send(new ScanCommand(scanParams));

    if (!result.Items?.length) {
      console.log('ℹ️ No records found');
      return null;
    }

    const parsed = result.Items
      .map(item => {
        try {
          const p = item.payload?.M || item;
          const ts = Number(p.timestamp?.S ?? p.timestamp?.N ?? p.timestamp ?? Date.now());
          const lat = Number(p.latitude?.S ?? p.latitude?.N ?? p.latitude);
          const lon = Number(p.longitude?.S ?? p.longitude?.N ?? p.longitude);
          const alt = Number(p.altitude?.S ?? p.altitude?.N ?? p.altitude ?? 0);

          // Reproject to UTM Zone 18N and apply offset
          const [easting, northing] = proj4(WGS84, UTM18N, [lon, lat]);
          const x = easting
          const y = northing 
          const z = alt + 34

          // Get custom data
          const customData = p.custom?.M || p.custom || {};
          const magneticField = customData.magnetic_field?.M || customData.magnetic_field || {};
          
          // Sensor fields - now reading from custom object
          const mag_x = Number(magneticField.x?.S ?? magneticField.x?.N ?? magneticField.x ?? NaN);
          const mag_y = Number(magneticField.y?.S ?? magneticField.y?.N ?? magneticField.y ?? NaN);
          const mag_z = Number(magneticField.z?.S ?? magneticField.z?.N ?? magneticField.z ?? NaN);
          const light_level = Number(customData.light_level?.S ?? customData.light_level?.N ?? customData.light_level ?? NaN);
          const pressure = Number(customData.pressure?.S ?? customData.pressure?.N ?? customData.pressure ?? NaN);
          const sound_level = Number(customData.sound_level?.S ?? customData.sound_level?.N ?? customData.sound_level ?? NaN);

          return {
            deviceId: item.deviceId?.S,
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

    // Si se especifica deviceId, retorna el último registro de ese dispositivo
    // Si no, retorna el último registro de cada dispositivo
    if (deviceId) {
      const latest = parsed.sort((a, b) => b.timestamp - a.timestamp)[0];
      console.log(`📌 Latest record for ${deviceId}:`, latest);
      return latest;
    } else {
      const latestByDevice = {};      parsed.forEach(record => {
        if (!latestByDevice[record.deviceId] || 
            record.timestamp > latestByDevice[record.deviceId].timestamp) {
          latestByDevice[record.deviceId] = record;
        }
      });
      const results = Object.values(latestByDevice);
      console.log('📌 Latest records:', results);
      return results;
    }
  } catch (err) {
    console.error('❌ Error fetching latest position:', err);
    return null;
  }
}

module.exports = { getLatestPosition, getAllPhones };