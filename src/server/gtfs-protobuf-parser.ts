/**
 * GTFS-Realtime Protobuf Parser
 * Parses Protocol Buffer messages from TTC GTFS-Realtime API
 * 
 * GTFS-RT Specification: https://developers.google.com/transit/gtfs-realtime
 */

import https from 'https';

// ============================================================================
// GTFS-RT MESSAGE TYPES
// ============================================================================

/**
 * Trip descriptor identifies a trip uniquely
 */
export interface TripDescriptor {
  tripId: string;
  routeId: string;
  directionId?: number;
  startTime?: string;
  startDate?: string;
  scheduleRelationship?: 'SCHEDULED' | 'ADDED' | 'UNSCHEDULED' | 'CANCELED';
}

/**
 * Route-specific alert
 */
export interface AlertEntity {
  alertId: string;
  activePeriod?: {
    start?: number;
    end?: number;
  };
  informedEntity?: {
    agencyId?: string;
    routeId?: string;
    routeType?: number;
    stopId?: string;
    trip?: TripDescriptor;
  }[];
  cause?: string;
  effect?: string;
  url?: string;
  headerText?: string;
  descriptionText?: string;
  ttsHeaderText?: string;
  ttsDescriptionText?: string;
}

/**
 * Trip update with real-time information
 */
export interface TripUpdate {
  trip: TripDescriptor;
  stopTimeUpdate?: {
    stopSequence?: number;
    stopId?: string;
    arrival?: {
      time?: number;
      delay?: number;
      uncertainty?: number;
    };
    departure?: {
      time?: number;
      delay?: number;
      uncertainty?: number;
    };
    departureOccupancyStatus?: string;
    scheduleRelationship?: 'SCHEDULED' | 'SKIPPED' | 'NO_DATA';
  }[];
  vehicleId?: string;
  timestamp?: number;
  delay?: number;
  tripProperties?: {
    tripId?: string;
    startTime?: string;
    startDate?: string;
    scheduleRelationship?: string;
  };
}

/**
 * GTFS-RT FeedMessage (root entity)
 */
export interface GTFSRealtimeFeed {
  header: {
    gtfsRealtimeVersion: string;
    incrementality: 'FULL_DATASET' | 'DIFFERENTIAL';
    timestamp: number;
  };
  entity: {
    id: string;
    isDeleted?: boolean;
    tripUpdate?: TripUpdate;
    vehiclePosition?: {
      trip?: TripDescriptor;
      vehicle?: {
        id?: string;
        label?: string;
        licensePlate?: string;
      };
      position?: {
        latitude: number;
        longitude: number;
        bearing?: number;
        odometer?: number;
        speed?: number;
      };
      currentStopSequence?: number;
      stopId?: string;
      currentStatus?: 'INCOMING_AT' | 'STOPPED_AT' | 'IN_TRANSIT_TO';
      timestamp?: number;
      congestionLevel?: string;
      occupancyStatus?: string;
    };
    alert?: AlertEntity;
  }[];
}

// ============================================================================
// PROTOBUF PARSING
// ============================================================================

/**
 * Simple protobuf varint decoder
 * Used for parsing GTFS-RT messages
 */
function decodeVarint(buffer: Buffer, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let pos = offset;

  while (true) {
    const byte = buffer[pos];
    value |= (byte & 0x7f) << shift;
    pos++;

    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }

  return [value, pos];
}

/**
 * Decode protobuf field key (field number + wire type)
 * Wire types: 0=varint, 1=64bit, 2=delimited, 3=start group, 4=end group, 5=32bit
 */
function decodeKey(key: number): [number, number] {
  const fieldNumber = key >> 3;
  const wireType = key & 0x7;
  return [fieldNumber, wireType];
}

/**
 * Parse GTFS-Realtime protobuf from TTC API
 * Returns parsed alerts and trip updates for frequency analysis
 */
export async function parseGTFSRealtimeProtobuf(): Promise<{
  alerts: AlertEntity[];
  tripUpdates: TripUpdate[];
  timestamp: number;
}> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.ttc.ca',
      path: '/gtfs-realtime/alerts',
      method: 'GET',
      headers: {
        'User-Agent': 'toronto-downtime/1.0',
      },
    };

    console.log('📡 Fetching GTFS-Realtime data from TTC API...');

    https
      .request(options, (res) => {
        let data = Buffer.alloc(0);

        res.on('data', (chunk: Buffer) => {
          data = Buffer.concat([data, chunk]);
        });

        res.on('end', () => {
          try {
            // Parse protobuf buffer
            const feed = parseGTFSRealtimeBuffer(data);

            console.log(
              `✅ Parsed GTFS-RT: ${feed.entity.length} entities, timestamp: ${new Date(feed.header.timestamp * 1000).toISOString()}`
            );

            // Extract alerts and trip updates
            const alerts: AlertEntity[] = [];
            const tripUpdates: TripUpdate[] = [];

            feed.entity.forEach((entity) => {
              if (entity.alert) {
                alerts.push(entity.alert);
              }
              if (entity.tripUpdate) {
                tripUpdates.push(entity.tripUpdate);
              }
            });

            resolve({
              alerts,
              tripUpdates,
              timestamp: feed.header.timestamp * 1000,
            });
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject)
      .setTimeout(5000, function () {
        (this as any).destroy();
        reject(new Error('GTFS-RT request timeout'));
      })
      .end();
  });
}

/**
 * Parse raw protobuf buffer into GTFSRealtimeFeed
 * Simplified parser focusing on alerts and trip frequency
 */
function parseGTFSRealtimeBuffer(buffer: Buffer): GTFSRealtimeFeed {
  const feed: GTFSRealtimeFeed = {
    header: {
      gtfsRealtimeVersion: '2.0',
      incrementality: 'FULL_DATASET',
      timestamp: Math.floor(Date.now() / 1000),
    },
    entity: [],
  };

  let pos = 0;

  while (pos < buffer.length) {
    try {
      const [key, nextPos] = decodeVarint(buffer, pos);
      const [fieldNumber, wireType] = decodeKey(key);

      pos = nextPos;

      if (fieldNumber === 1) {
        // header field
        if (wireType === 2) {
          // delimited
          const [length, newPos] = decodeVarint(buffer, pos);
          const headerBuffer = buffer.slice(newPos, newPos + length);
          pos = newPos + length;

          const header = parseProtobufHeader(headerBuffer);
          feed.header = { ...feed.header, ...header };
        }
      } else if (fieldNumber === 2) {
        // entity field (repeated)
        if (wireType === 2) {
          // delimited
          const [length, newPos] = decodeVarint(buffer, pos);
          const entityBuffer = buffer.slice(newPos, newPos + length);
          pos = newPos + length;

          const entity = parseProtobufEntity(entityBuffer);
          if (entity) {
            feed.entity.push(entity);
          }
        }
      } else {
        // Skip unknown fields
        if (wireType === 0) {
          [, pos] = decodeVarint(buffer, pos);
        } else if (wireType === 2) {
          const [length, newPos] = decodeVarint(buffer, pos);
          pos = newPos + length;
        } else if (wireType === 5) {
          pos += 4;
        } else if (wireType === 1) {
          pos += 8;
        }
      }
    } catch (err) {
      // Stop parsing on error
      break;
    }
  }

  return feed;
}

/**
 * Parse header message from protobuf
 */
function parseProtobufHeader(buffer: Buffer): Partial<GTFSRealtimeFeed['header']> {
  const header: Partial<GTFSRealtimeFeed['header']> = {};
  let pos = 0;

  while (pos < buffer.length) {
    const [key, nextPos] = decodeVarint(buffer, pos);
    const [fieldNumber, wireType] = decodeKey(key);

    pos = nextPos;

    if (fieldNumber === 1 && wireType === 0) {
      // gtfs_realtime_version (varint)
      const [version, newPos] = decodeVarint(buffer, pos);
      pos = newPos;
      header.gtfsRealtimeVersion = `${version}`;
    } else if (fieldNumber === 2 && wireType === 0) {
      // incrementality (varint)
      const [value, newPos] = decodeVarint(buffer, pos);
      pos = newPos;
      header.incrementality = value === 0 ? 'FULL_DATASET' : 'DIFFERENTIAL';
    } else if (fieldNumber === 3 && wireType === 0) {
      // timestamp (varint)
      [header.timestamp, pos] = decodeVarint(buffer, pos);
    } else {
      // Skip unknown
      if (wireType === 0) {
        [, pos] = decodeVarint(buffer, pos);
      } else if (wireType === 2) {
        const [length, newPos] = decodeVarint(buffer, pos);
        pos = newPos + length;
      }
    }
  }

  return header;
}

/**
 * Parse entity message from protobuf
 */
function parseProtobufEntity(buffer: Buffer): GTFSRealtimeFeed['entity'][0] | null {
  let id = '';
  let isDeleted = false;
  let tripUpdate: TripUpdate | undefined;
  let alert: AlertEntity | undefined;

  let pos = 0;

  while (pos < buffer.length) {
    const [key, nextPos] = decodeVarint(buffer, pos);
    const [fieldNumber, wireType] = decodeKey(key);

    pos = nextPos;

    if (fieldNumber === 1 && wireType === 2) {
      // id (string)
      const [length, newPos] = decodeVarint(buffer, pos);
      id = buffer.slice(newPos, newPos + length).toString('utf-8');
      pos = newPos + length;
    } else if (fieldNumber === 2 && wireType === 0) {
      // is_deleted (bool)
      const [deletedValue, newPos] = decodeVarint(buffer, pos);
      isDeleted = deletedValue !== 0;
      pos = newPos;
    } else if (fieldNumber === 3 && wireType === 2) {
      // trip_update
      const [length, newPos] = decodeVarint(buffer, pos);
      tripUpdate = parseProtobufTripUpdate(buffer.slice(newPos, newPos + length));
      pos = newPos + length;
    } else if (fieldNumber === 5 && wireType === 2) {
      // alert
      const [length, newPos] = decodeVarint(buffer, pos);
      alert = parseProtobufAlert(buffer.slice(newPos, newPos + length));
      pos = newPos + length;
    } else {
      // Skip unknown
      if (wireType === 0) {
        [, pos] = decodeVarint(buffer, pos);
      } else if (wireType === 2) {
        const [length, newPos] = decodeVarint(buffer, pos);
        pos = newPos + length;
      }
    }
  }

  if (!id) return null;

  return {
    id,
    isDeleted,
    tripUpdate,
    alert,
  };
}

/**
 * Parse trip update message (simplified)
 */
function parseProtobufTripUpdate(buffer: Buffer): TripUpdate {
  const tripUpdate: TripUpdate = {
    trip: {
      tripId: '',
      routeId: '',
    },
  };

  // Simplified: just extract trip ID and route ID for frequency counting
  let pos = 0;

  while (pos < buffer.length) {
    const [key, nextPos] = decodeVarint(buffer, pos);
    const [fieldNumber, wireType] = decodeKey(key);

    pos = nextPos;

    if (fieldNumber === 1 && wireType === 2) {
      // trip descriptor
      const [length, newPos] = decodeVarint(buffer, pos);
      const tripBuffer = buffer.slice(newPos, newPos + length);
      pos = newPos + length;

      // Parse trip descriptor fields
      let tripPos = 0;
      while (tripPos < tripBuffer.length) {
        const [tripKey, tripNextPos] = decodeVarint(tripBuffer, tripPos);
        const [tripField, tripWire] = decodeKey(tripKey);
        tripPos = tripNextPos;

        if (tripField === 1 && tripWire === 2) {
          // trip_id
          const [len, nPos] = decodeVarint(tripBuffer, tripPos);
          tripUpdate.trip.tripId = tripBuffer.slice(nPos, nPos + len).toString('utf-8');
          tripPos = nPos + len;
        } else if (tripField === 5 && tripWire === 2) {
          // route_id
          const [len, nPos] = decodeVarint(tripBuffer, tripPos);
          tripUpdate.trip.routeId = tripBuffer.slice(nPos, nPos + len).toString('utf-8');
          tripPos = nPos + len;
        } else {
          if (tripWire === 0) {
            [, tripPos] = decodeVarint(tripBuffer, tripPos);
          } else if (tripWire === 2) {
            const [len, nPos] = decodeVarint(tripBuffer, tripPos);
            tripPos = nPos + len;
          }
        }
      }
    } else {
      // Skip other fields
      if (wireType === 0) {
        [, pos] = decodeVarint(buffer, pos);
      } else if (wireType === 2) {
        const [length, newPos] = decodeVarint(buffer, pos);
        pos = newPos + length;
      }
    }
  }

  return tripUpdate;
}

/**
 * Parse alert message (simplified)
 */
function parseProtobufAlert(buffer: Buffer): AlertEntity {
  const alert: AlertEntity = {
    alertId: '',
  };

  let pos = 0;

  while (pos < buffer.length) {
    const [key, nextPos] = decodeVarint(buffer, pos);
    const [fieldNumber, wireType] = decodeKey(key);

    pos = nextPos;

    if (fieldNumber === 6 && wireType === 2) {
      // header_text (TranslatedString)
      const [length, newPos] = decodeVarint(buffer, pos);
      // Simplified: extract raw bytes as text
      alert.headerText = buffer.slice(newPos, newPos + length).toString('utf-8');
      pos = newPos + length;
    } else if (fieldNumber === 7 && wireType === 2) {
      // description_text
      const [length, newPos] = decodeVarint(buffer, pos);
      alert.descriptionText = buffer.slice(newPos, newPos + length).toString('utf-8');
      pos = newPos + length;
    } else {
      // Skip unknown
      if (wireType === 0) {
        [, pos] = decodeVarint(buffer, pos);
      } else if (wireType === 2) {
        const [length, newPos] = decodeVarint(buffer, pos);
        pos = newPos + length;
      }
    }
  }

  return alert;
}

/**
 * Calculate route frequency from trip updates
 * Count trips per route across all updates
 */
export function calculateFrequencyFromTrips(
  tripUpdates: TripUpdate[]
): Map<string, number> {
  const frequencyMap = new Map<string, number>();

  tripUpdates.forEach((update) => {
    const routeId = update.trip.routeId;
    if (routeId) {
      const current = frequencyMap.get(routeId) || 0;
      frequencyMap.set(routeId, current + 1);
    }
  });

  return frequencyMap;
}

/**
 * Extract route segments from GTFS-RT data
 * Groups trips by route and calculates frequency
 */
export function extractRouteSegments(
  tripUpdates: TripUpdate[],
  routeMetadata?: Map<string, { name: string; type: string }>
) {
  const frequencyMap = calculateFrequencyFromTrips(tripUpdates);
  const segments: Array<{
    routeId: string;
    routeName: string;
    routeType: string;
    frequency: number;
    geometry: any[];
  }> = [];

  frequencyMap.forEach((frequency, routeId) => {
    const metadata = routeMetadata?.get(routeId);
    segments.push({
      routeId,
      routeName: metadata?.name || `Route ${routeId}`,
      routeType: metadata?.type || 'bus',
      frequency,
      // Geometry would need to come from static GTFS shapes.txt
      geometry: [],
    });
  });

  return segments;
}
