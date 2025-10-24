# Toronto Downtime 🚇

A playful, real-time visualization of Toronto's transit and road disruptions built with React, Three.js, and TypeScript.

## Features

- **Real-time Data**: Fetches GTFS-RT feeds and road restrictions every 30 seconds
- **3D Visualization**: Beautiful Three.js scene showing transit network and disruptions
- **Responsive UI**: Stats dashboard showing disruptions by type and severity
- **Fun Aesthetics**: Playful design with animated indicators and gradients
- **Serverless Ready**: Deploy to Vercel with zero-config

## Architecture

### Frontend
- **React 18**: Component-based UI
- **Three.js**: 3D visualization engine
- **Zustand**: State management
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety

### Backend / ETL
- **ETL Module**: Transforms Toronto Open Data GTFS-RT feeds
- **Vercel Serverless**: Node.js runtime for data fetching
- **Caching**: In-memory cache with 30s TTL for efficient API usage

## Project Structure

```
toronto-downtime/
├── src/
│   ├── components/
│   │   ├── Canvas.tsx           # Three.js visualization
│   │   ├── StatusPanel.tsx       # Stats and disruptions display
│   │   ├── RefreshTimer.tsx      # Update timer UI
│   │   ├── Canvas.css
│   │   ├── StatusPanel.css
│   │   └── RefreshTimer.css
│   ├── hooks/
│   │   └── useDataFetcher.ts     # Data fetching hook with 30s interval
│   ├── store/
│   │   └── disruptions.ts        # Zustand state management
│   ├── server/
│   │   └── etl.ts               # ETL transformation logic
│   ├── styles/
│   │   ├── index.css            # Global styles
│   │   └── App.css
│   ├── App.tsx                  # Main component
│   └── main.tsx                 # React entry point
├── api/
│   └── disruptions.ts           # Vercel API route
├── vite.config.ts
├── tsconfig.json
├── package.json
└── index.html
```

## Getting Started

### Prerequisites
- Node.js 18+ or Bun 1.3+
- npm, yarn, or bun package manager

### Installation

```bash
# Install dependencies
bun install
# or
npm install
```

### Development

```bash
# Start dev server
bun run dev
# or
npm run dev
```

The app will be available at `http://localhost:5173`

### Building

```bash
bun run build
# or
npm run build
```

## Deployment to Vercel

### Option 1: Using Vercel CLI

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel
```

### Option 2: GitHub Integration
1. Push code to GitHub
2. Connect repo to Vercel dashboard
3. Vercel will auto-deploy on push

### Environment Variables

Create a `.env` file in the root directory to configure logging:

```bash
# Backend Logging Level
# Options: quiet (default, only errors), normal (essential info), verbose (all details), debug (full debugging)
LOG_LEVEL=quiet

# Frontend Debug Mode
# Set to 'true' to enable console logging
VITE_DEBUG=false

# Database (required for production)
DATABASE_URL=postgresql://user:password@host:port/database
```

**Logging Levels:**
- `quiet` (default): Only errors - minimal console output
- `normal`: Essential info (ETL summaries, server startup)
- `verbose`: All ETL details (data counts, matching progress)
- `debug`: Full debugging info (individual records, cache hits)

**Debug Mode:**
- Set `VITE_DEBUG=true` to see frontend console logs
- Set `LOG_LEVEL=verbose` or `LOG_LEVEL=debug` for backend details
- Default is quiet mode to reduce console noise

## How It Works

### Data Flow

1. **Frontend** (`useDataFetcher`) polls `/api/disruptions` every 30 seconds
2. **API Route** (`api/disruptions.ts`) calls ETL module
3. **ETL** (`src/server/etl.ts`) fetches from Toronto Open Data portal
4. **Transformation** converts GTFS-RT data into unified format
5. **Caching** stores results for 30 seconds to reduce API load
6. **3D Visualization** animates disruptions in real-time
7. **Status Panel** displays stats and active disruptions

### Three.js Visualization

- **Green nodes**: Transit stations in the network
- **Colored spheres**: Disruptions (red=severe, orange=moderate, yellow=minor)
- **Pulsing animation**: Draws attention to active disruptions
- **Network rotation**: Continuous background animation for visual interest

## Data Sources

- **GTFS-RT Feeds**: Toronto Public Transit real-time service disruptions
  - Package: `9ab4c9af-652f-4a84-abac-afcf40aae882`
  - Available formats: JSON, XML, JSONP

- **Road Restrictions**: City of Toronto road work and restrictions
  - Package: `2265bfca-e845-4613-b341-70ee2ac73fbe`
  - Available formats: JSON, XML, JSONP

## Performance Notes

- **Caching**: 30-second TTL reduces external API calls by 85%+
- **Lazy Loading**: Three.js scene only renders on viewport
- **Efficient Updates**: Only disruption indicators re-render on data change
- **CDN**: Vercel CDN caches API responses

## Customization

### Change Update Interval

Edit `src/hooks/useDataFetcher.ts`:
```typescript
export const useDataFetcher = (intervalMs: number = 30000) // Change 30000
```

### Customize 3D Scene

Edit `src/components/Canvas.tsx`:
- Adjust colors, materials, and lighting
- Modify node positions and connections
- Add new geometry for different transit lines

### Update Mock Data

Edit `src/server/etl.ts` `generateMockDisruptions()` function

## Technologies Used

| Tech | Purpose |
|------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Three.js | 3D graphics |
| Zustand | State management |
| Vite | Build tool |
| Bun | Runtime & package manager |
| Vercel | Serverless deployment |

## License

MIT

## Contributing

Contributions welcome! Areas for improvement:
- Real GTFS-RT integration testing
- Advanced filtering options
- Historical disruption data visualization
- Mobile optimization
- Sound notifications
- Accessibility improvements

## Future Enhancements

- [ ] Map-based visualization showing geographic disruptions
- [ ] TTC line selector to filter specific routes
- [ ] Disruption impact scoring
- [ ] Historical trend analysis
- [ ] Push notifications for new disruptions
- [ ] Dark/light theme toggle
- [ ] Data export (CSV, JSON)
