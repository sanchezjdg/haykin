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
 * Gets all unique phone numbers from the Positions table
 * @returns {Array<string>} Array of phone numbers
 */
async function getAllPhones() {
  try {
    const result = await dbClient.send(
      new ScanCommand({ 
        TableName: 'Positions',
        ProjectionExpression: 'phone'
      })
    );

    if (!result.Items?.length) return [];

    const phones = [...new Set(result.Items.map(item => item.phone.S))];
    console.log('📱 Found phones:', phones);
    return phones;
  } catch (err) {
    console.error('❌ Error fetching phones:', err);
    return [];
  }
}

/**
 * Fetches and returns the latest position record for a specific phone or all phones
 * @param {string} [phone] Optional phone number to filter by
 * @returns {Object|Array|null} Latest position data
 */
async function getLatestPosition(phone = null) {
  try {
    const scanParams = {
      TableName: 'Positions'
    };
    
    if (phone) {
      scanParams.FilterExpression = 'phone = :phone';
      scanParams.ExpressionAttributeValues = {
        ':phone': { S: phone }
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
            phone: item.phone.S,
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

    // If phone is specified, return single latest record
    // If no phone specified, return latest record for each phone
    if (phone) {
      const latest = parsed.sort((a, b) => b.timestamp - a.timestamp)[0];
      console.log(`📌 Latest record for ${phone}:`, latest);
      return latest;
    } else {
      const latestByPhone = {};
      parsed.forEach(record => {
        if (!latestByPhone[record.phone] || 
            record.timestamp > latestByPhone[record.phone].timestamp) {
          latestByPhone[record.phone] = record;
        }
      });
      const results = Object.values(latestByPhone);
      console.log('📌 Latest records:', results);
      return results;
    }
  } catch (err) {
    console.error('❌ Error fetching latest position:', err);
    return null;
  }
}

module.exports = { getLatestPosition, getAllPhones };