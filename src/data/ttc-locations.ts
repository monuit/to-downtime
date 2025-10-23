/**
 * TTC Station and Stop Coordinates Database
 * Geographic coordinates for TTC subway stations, streetcar stops, and major bus terminals
 * 
 * Data sources:
 * - TTC GTFS stops.txt
 * - OpenStreetMap
 * - TTC official station list
 */

export interface StationCoordinate {
  name: string
  lat: number
  lon: number
  lines?: string[] // Which lines serve this station
}

/**
 * TTC Subway Stations by Line
 */
export const SubwayStations: Record<string, StationCoordinate[]> = {
  // Line 1: Yonge-University-Spadina
  '1': [
    { name: 'Vaughan Metropolitan Centre', lat: 43.7940, lon: -79.5085, lines: ['1'] },
    { name: 'Highway 407', lat: 43.7799, lon: -79.5180, lines: ['1'] },
    { name: 'Pioneer Village', lat: 43.7735, lon: -79.5039, lines: ['1'] },
    { name: 'York University', lat: 43.7669, lon: -79.4968, lines: ['1'] },
    { name: 'Finch West', lat: 43.7613, lon: -79.5113, lines: ['1'] },
    { name: 'Downsview Park', lat: 43.7544, lon: -79.4526, lines: ['1'] },
    { name: 'Sheppard West', lat: 43.7366, lon: -79.4523, lines: ['1'] },
    { name: 'Wilson', lat: 43.7101, lon: -79.4516, lines: ['1'] },
    { name: 'Yorkdale', lat: 43.6833, lon: -79.4522, lines: ['1'] },
    { name: 'Lawrence West', lat: 43.6635, lon: -79.4530, lines: ['1'] },
    { name: 'Glencairn', lat: 43.6515, lon: -79.4537, lines: ['1'] },
    { name: 'Eglinton West', lat: 43.6982, lon: -79.4350, lines: ['1'] },
    { name: 'St. Clair West', lat: 43.6838, lon: -79.4153, lines: ['1'] },
    { name: 'Dupont', lat: 43.6678, lon: -79.4065, lines: ['1'] },
    { name: 'Spadina', lat: 43.6636, lon: -79.4208, lines: ['1'] },
    { name: 'St. George', lat: 43.6518, lon: -79.4055, lines: ['1', '2'] },
    { name: 'Museum', lat: 43.6451, lon: -79.4020, lines: ['1'] },
    { name: "Queen's Park", lat: 43.6425, lon: -79.3873, lines: ['1'] },
    { name: 'St. Patrick', lat: 43.6435, lon: -79.3793, lines: ['1'] },
    { name: 'Osgoode', lat: 43.6540, lon: -79.3835, lines: ['1'] },
    { name: 'St. Andrew', lat: 43.6480, lon: -79.3788, lines: ['1'] },
    { name: 'Union', lat: 43.6451, lon: -79.3805, lines: ['1'] },
    { name: 'King', lat: 43.6415, lon: -79.3812, lines: ['1'] },
    { name: 'Queen', lat: 43.6289, lon: -79.3943, lines: ['1'] },
    { name: 'Dundas', lat: 43.6563, lon: -79.3804, lines: ['1'] },
    { name: 'College', lat: 43.6611, lon: -79.3833, lines: ['1'] },
    { name: 'Wellesley', lat: 43.6651, lon: -79.3834, lines: ['1'] },
    { name: 'Bloor-Yonge', lat: 43.6707, lon: -79.3863, lines: ['1', '2'] },
    { name: 'Rosedale', lat: 43.6775, lon: -79.3904, lines: ['1'] },
    { name: 'Summerhill', lat: 43.6800, lon: -79.3947, lines: ['1'] },
    { name: 'St. Clair', lat: 43.6868, lon: -79.3936, lines: ['1'] },
    { name: 'Davisville', lat: 43.6917, lon: -79.3936, lines: ['1'] },
    { name: 'Eglinton', lat: 43.7067, lon: -79.3981, lines: ['1'] },
    { name: 'Lawrence', lat: 43.7253, lon: -79.4023, lines: ['1'] },
    { name: 'York Mills', lat: 43.7455, lon: -79.4078, lines: ['1'] },
    { name: 'Sheppard-Yonge', lat: 43.7613, lon: -79.4108, lines: ['1', '4'] },
    { name: 'North York Centre', lat: 43.7679, lon: -79.4130, lines: ['1'] },
    { name: 'Finch', lat: 43.7806, lon: -79.4153, lines: ['1'] },
  ],

  // Line 2: Bloor-Danforth
  '2': [
    { name: 'Kipling', lat: 43.6368, lon: -79.5350, lines: ['2'] },
    { name: 'Islington', lat: 43.6456, lon: -79.5244, lines: ['2'] },
    { name: 'Royal York', lat: 43.6485, lon: -79.5118, lines: ['2'] },
    { name: 'Old Mill', lat: 43.6503, lon: -79.4945, lines: ['2'] },
    { name: 'Jane', lat: 43.6511, lon: -79.4815, lines: ['2'] },
    { name: 'Runnymede', lat: 43.6518, lon: -79.4765, lines: ['2'] },
    { name: 'High Park', lat: 43.6535, lon: -79.4666, lines: ['2'] },
    { name: 'Keele', lat: 43.6536, lon: -79.4595, lines: ['2'] },
    { name: 'Dundas West', lat: 43.6564, lon: -79.4528, lines: ['2'] },
    { name: 'Lansdowne', lat: 43.6594, lon: -79.4429, lines: ['2'] },
    { name: 'Dufferin', lat: 43.6604, lon: -79.4353, lines: ['2'] },
    { name: 'Ossington', lat: 43.6626, lon: -79.4209, lines: ['2'] },
    { name: 'Christie', lat: 43.6644, lon: -79.4179, lines: ['2'] },
    { name: 'Bathurst', lat: 43.6663, lon: -79.4111, lines: ['2'] },
    { name: 'Spadina', lat: 43.6675, lon: -79.4037, lines: ['2'] },
    { name: 'St. George', lat: 43.6683, lon: -79.3996, lines: ['1', '2'] },
    { name: 'Bay', lat: 43.6700, lon: -79.3901, lines: ['2'] },
    { name: 'Bloor-Yonge', lat: 43.6707, lon: -79.3863, lines: ['1', '2'] },
    { name: 'Sherbourne', lat: 43.6716, lon: -79.3763, lines: ['2'] },
    { name: 'Castle Frank', lat: 43.6741, lon: -79.3687, lines: ['2'] },
    { name: 'Broadview', lat: 43.6769, lon: -79.3576, lines: ['2'] },
    { name: 'Chester', lat: 43.6786, lon: -79.3528, lines: ['2'] },
    { name: 'Pape', lat: 43.6800, lon: -79.3454, lines: ['2'] },
    { name: 'Donlands', lat: 43.6813, lon: -79.3378, lines: ['2'] },
    { name: 'Greenwood', lat: 43.6826, lon: -79.3296, lines: ['2'] },
    { name: 'Coxwell', lat: 43.6840, lon: -79.3223, lines: ['2'] },
    { name: 'Woodbine', lat: 43.6857, lon: -79.3124, lines: ['2'] },
    { name: 'Main Street', lat: 43.6889, lon: -79.3029, lines: ['2'] },
    { name: 'Victoria Park', lat: 43.6964, lon: -79.2899, lines: ['2'] },
    { name: 'Warden', lat: 43.7111, lon: -79.2818, lines: ['2'] },
    { name: 'Kennedy', lat: 43.7312, lon: -79.2642, lines: ['2'] },
  ],

  // Line 3: Scarborough RT (now replaced by Line 2 extension, but including for legacy)
  '3': [
    { name: 'Kennedy', lat: 43.7312, lon: -79.2642, lines: ['2', '3'] },
    { name: 'Lawrence East', lat: 43.7503, lon: -79.2691, lines: ['3'] },
    { name: 'Ellesmere', lat: 43.7679, lon: -79.2715, lines: ['3'] },
    { name: 'Midland', lat: 43.7703, lon: -79.2691, lines: ['3'] },
    { name: 'Scarborough Centre', lat: 43.7736, lon: -79.2578, lines: ['3'] },
    { name: 'McCowan', lat: 43.7744, lon: -79.2513, lines: ['3'] },
  ],

  // Line 4: Sheppard
  '4': [
    { name: 'Sheppard-Yonge', lat: 43.7613, lon: -79.4108, lines: ['1', '4'] },
    { name: 'Bayview', lat: 43.7674, lon: -79.3858, lines: ['4'] },
    { name: 'Bessarion', lat: 43.7682, lon: -79.3752, lines: ['4'] },
    { name: 'Leslie', lat: 43.7689, lon: -79.3604, lines: ['4'] },
    { name: 'Don Mills', lat: 43.7745, lon: -79.3463, lines: ['4'] },
  ],

  // Line 5: Eglinton (under construction/recently opened)
  '5': [
    { name: 'Mount Dennis', lat: 43.6886, lon: -79.4870, lines: ['5'] },
    { name: 'Keelesdale', lat: 43.6949, lon: -79.4694, lines: ['5'] },
    { name: 'Caledonia', lat: 43.6990, lon: -79.4568, lines: ['5'] },
    { name: 'Fairbank', lat: 43.7014, lon: -79.4474, lines: ['5'] },
    { name: 'Oakwood', lat: 43.7041, lon: -79.4379, lines: ['5'] },
    { name: 'Forest Hill', lat: 43.7004, lon: -79.4117, lines: ['5'] },
    { name: 'Eglinton', lat: 43.7067, lon: -79.3981, lines: ['1', '5'] },
    { name: 'Science Centre', lat: 43.7181, lon: -79.3380, lines: ['5'] },
    { name: 'Kennedy', lat: 43.7312, lon: -79.2642, lines: ['2', '5'] },
  ],
}

/**
 * Major streetcar stops (key intersections)
 */
export const StreetcarStops: Record<string, StationCoordinate[]> = {
  '501': [ // Queen
    { name: 'Queen & Neville Park', lat: 43.6673, lon: -79.2978 },
    { name: 'Queen & Coxwell', lat: 43.6699, lon: -79.3215 },
    { name: 'Queen & Broadview', lat: 43.6560, lon: -79.3577 },
    { name: 'Queen & Sherbourne', lat: 43.6546, lon: -79.3750 },
    { name: 'Queen & Yonge', lat: 43.6524, lon: -79.3789 },
    { name: 'Queen & University', lat: 43.6505, lon: -79.3881 },
    { name: 'Queen & Spadina', lat: 43.6480, lon: -79.3995 },
    { name: 'Queen & Bathurst', lat: 43.6471, lon: -79.4111 },
    { name: 'Queen & Dufferin', lat: 43.6453, lon: -79.4354 },
    { name: 'Queen & Roncesvalles', lat: 43.6392, lon: -79.4487 },
  ],
  '504': [ // King
    { name: 'King & Broadview', lat: 43.6561, lon: -79.3575 },
    { name: 'King & Parliament', lat: 43.6514, lon: -79.3649 },
    { name: 'King & Yonge', lat: 43.6488, lon: -79.3773 },
    { name: 'King & University', lat: 43.6472, lon: -79.3863 },
    { name: 'King & Spadina', lat: 43.6453, lon: -79.3966 },
    { name: 'King & Bathurst', lat: 43.6444, lon: -79.4102 },
    { name: 'King & Dufferin', lat: 43.6394, lon: -79.4344 },
  ],
  '505': [ // Dundas
    { name: 'Dundas & Broadview', lat: 43.6702, lon: -79.3575 },
    { name: 'Dundas & Parliament', lat: 43.6592, lon: -79.3645 },
    { name: 'Dundas & Yonge', lat: 43.6563, lon: -79.3804 },
    { name: 'Dundas & University', lat: 43.6551, lon: -79.3876 },
    { name: 'Dundas & Spadina', lat: 43.6533, lon: -79.3978 },
    { name: 'Dundas & Bathurst', lat: 43.6526, lon: -79.4108 },
    { name: 'Dundas West Station', lat: 43.6564, lon: -79.4528 },
  ],
  '506': [ // Carlton
    { name: 'Main Street Station', lat: 43.6889, lon: -79.3029 },
    { name: 'Gerrard & Coxwell', lat: 43.6769, lon: -79.3221 },
    { name: 'College & Yonge', lat: 43.6611, lon: -79.3833 },
    { name: 'College & University', lat: 43.6599, lon: -79.3916 },
    { name: 'College & Spadina', lat: 43.6587, lon: -79.4020 },
    { name: 'College & Bathurst', lat: 43.6580, lon: -79.4148 },
    { name: 'High Park Loop', lat: 43.6535, lon: -79.4666 },
  ],
  '510': [ // Spadina
    { name: 'Spadina Station', lat: 43.6675, lon: -79.4037 },
    { name: 'Spadina & College', lat: 43.6587, lon: -79.4020 },
    { name: 'Spadina & Queen', lat: 43.6480, lon: -79.3995 },
    { name: 'Spadina & King', lat: 43.6453, lon: -79.3966 },
    { name: 'Union Station', lat: 43.6451, lon: -79.3805 },
  ],
}

/**
 * Get station/stop coordinates for a given line
 */
export function getStationsForLine(lineNumber: string): StationCoordinate[] {
  // Try subway first
  if (SubwayStations[lineNumber]) {
    return SubwayStations[lineNumber]
  }
  
  // Try streetcar
  if (StreetcarStops[lineNumber]) {
    return StreetcarStops[lineNumber]
  }
  
  return []
}

/**
 * Get primary (first) station for a line (useful for fallback positioning)
 */
export function getPrimaryStationForLine(lineNumber: string): StationCoordinate | null {
  const stations = getStationsForLine(lineNumber)
  return stations.length > 0 ? stations[0] : null
}

/**
 * Find station by name (case-insensitive partial match)
 */
export function findStationByName(searchName: string): StationCoordinate | null {
  const searchLower = searchName.toLowerCase()
  
  // Search subway stations
  for (const stations of Object.values(SubwayStations)) {
    for (const station of stations) {
      if (station.name.toLowerCase().includes(searchLower)) {
        return station
      }
    }
  }
  
  // Search streetcar stops
  for (const stops of Object.values(StreetcarStops)) {
    for (const stop of stops) {
      if (stop.name.toLowerCase().includes(searchLower)) {
        return stop
      }
    }
  }
  
  return null
}

/**
 * Downtown Toronto fallback coordinates (for disruptions without specific location)
 */
export const DOWNTOWN_TORONTO: StationCoordinate = {
  name: 'Downtown Toronto',
  lat: 43.6532,
  lon: -79.3832,
}
