import { useState, useMemo, useRef, useEffect } from 'react';
import './FilterPanel.css';
import type { Disruption } from '../store/disruptions';

export interface FilterOptions {
  workTypes: string[];
  scheduleTypes: ('24/7' | 'Weekdays Only' | 'Weekends Included')[];
  durations: string[];
  impactLevels: ('Low' | 'Medium' | 'High')[];
  searchText: string;
}

interface FilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableWorkTypes: string[];
  disruptions: Disruption[];
  filteredCount?: number;
  totalCount?: number;
  isFiltering?: boolean;
}

const DURATION_OPTIONS = [
  '< 1 day',
  '1-7 days',
  '1-4 weeks',
  '1-3 months',
  '3+ months',
];

const SCHEDULE_OPTIONS: ('24/7' | 'Weekdays Only' | 'Weekends Included')[] = [
  '24/7',
  'Weekdays Only',
  'Weekends Included',
];

const IMPACT_OPTIONS: ('Low' | 'Medium' | 'High')[] = [
  'Low',
  'Medium',
  'High',
];

export function FilterPanel({ filters, onFiltersChange, availableWorkTypes, disruptions, filteredCount, totalCount, isFiltering }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Count disruptions per filter option
  const getCounts = useMemo(() => {
    const workTypeCounts: Record<string, number> = {};
    const scheduleCounts: Record<string, number> = {};
    const durationCounts: Record<string, number> = {};
    const impactCounts: Record<string, number> = {};

    disruptions.forEach(d => {
      // Work type counts
      if (d.workType) {
        workTypeCounts[d.workType] = (workTypeCounts[d.workType] || 0) + 1;
      }

      // Schedule counts
      if (d.scheduleType) {
        scheduleCounts[d.scheduleType] = (scheduleCounts[d.scheduleType] || 0) + 1;
      }

      // Duration counts
      if (d.duration) {
        durationCounts[d.duration] = (durationCounts[d.duration] || 0) + 1;
      }

      // Impact counts
      if (d.impactLevel) {
        impactCounts[d.impactLevel] = (impactCounts[d.impactLevel] || 0) + 1;
      }
    });

    return { workTypeCounts, scheduleCounts, durationCounts, impactCounts };
  }, [disruptions]);

  // Extract unique street names from disruptions
  const streetNames = useMemo(() => {
    const names = new Set<string>();
    const streetRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Pkwy|Parkway|Cres|Crescent|Pl|Place|Way|Lane|Ln|Ct|Court)\b/gi;
    
    disruptions.forEach(d => {
      // Extract from title
      const titleMatches = d.title.match(streetRegex);
      if (titleMatches) {
        titleMatches.forEach(match => names.add(match.trim()));
      }
      
      // Extract from description
      const descMatches = d.description.match(streetRegex);
      if (descMatches) {
        descMatches.forEach(match => names.add(match.trim()));
      }
    });
    
    return Array.from(names).sort();
  }, [disruptions]);

  // Filter suggestions based on search text
  const suggestions = useMemo(() => {
    if (!filters.searchText || filters.searchText.length < 2) {
      return [];
    }
    const searchLower = filters.searchText.toLowerCase();
    return streetNames.filter(name => 
      name.toLowerCase().includes(searchLower)
    ).slice(0, 10); // Limit to 10 suggestions
  }, [filters.searchText, streetNames]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current && 
        !searchInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleWorkType = (workType: string) => {
    const newWorkTypes = filters.workTypes.includes(workType)
      ? filters.workTypes.filter(t => t !== workType)
      : [...filters.workTypes, workType];
    onFiltersChange({ ...filters, workTypes: newWorkTypes });
  };

  const toggleScheduleType = (schedule: typeof SCHEDULE_OPTIONS[number]) => {
    const newSchedules = filters.scheduleTypes.includes(schedule)
      ? filters.scheduleTypes.filter(s => s !== schedule)
      : [...filters.scheduleTypes, schedule];
    onFiltersChange({ ...filters, scheduleTypes: newSchedules });
  };

  const toggleDuration = (duration: string) => {
    const newDurations = filters.durations.includes(duration)
      ? filters.durations.filter(d => d !== duration)
      : [...filters.durations, duration];
    onFiltersChange({ ...filters, durations: newDurations });
  };

  const toggleImpactLevel = (level: typeof IMPACT_OPTIONS[number]) => {
    const newLevels = filters.impactLevels.includes(level)
      ? filters.impactLevels.filter(l => l !== level)
      : [...filters.impactLevels, level];
    onFiltersChange({ ...filters, impactLevels: newLevels });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, searchText: e.target.value });
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onFiltersChange({ ...filters, searchText: suggestion });
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0) {
        handleSuggestionClick(suggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({
      workTypes: [],
      scheduleTypes: [],
      durations: [],
      impactLevels: [],
      searchText: '',
    });
  };

  const hasActiveFilters = 
    filters.workTypes.length > 0 ||
    filters.scheduleTypes.length > 0 ||
    filters.durations.length > 0 ||
    filters.impactLevels.length > 0 ||
    filters.searchText.length > 0;

  return (
    <div className={`filter-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="filter-header">
        <div className="filter-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="toggle-btn" 
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse filters' : 'Expand filters'}
            >
              {isExpanded ? '−' : '+'}
            </button>
            <h3>Filters</h3>
          </div>
          {filteredCount !== undefined && totalCount !== undefined && (
            <div className="filter-results-count">
              ({filteredCount}
              {filteredCount !== totalCount && (
                <span className="count-total"> of {totalCount}</span>
              )}
              {isFiltering && (
                <span style={{ marginLeft: '4px' }}>
                  filtering...
                </span>
              )})
            </div>
          )}
        </div>
        <div className="filter-actions">
          {hasActiveFilters && (
            <button className="clear-btn" onClick={clearAllFilters}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Search */}
          <div className="filter-section">
            <label className="filter-label">🔍 Search by Street</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Search road names..."
                value={filters.searchText}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                onFocus={() => filters.searchText.length >= 2 && setShowSuggestions(true)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} className="autocomplete-suggestions">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion}
                      className={`autocomplete-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Work Type */}
          <div className="filter-section">
            <label className="filter-label">
              🚧 Work Type 
              {filters.workTypes.length > 0 && (
                <span className="filter-count">({filters.workTypes.length} of {availableWorkTypes.length})</span>
              )}
            </label>
            <div className="filter-options">
              {availableWorkTypes.slice(0, 10).map(workType => (
                <label key={workType} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.workTypes.includes(workType)}
                    onChange={() => toggleWorkType(workType)}
                  />
                  <span className="filter-option-text">
                    <span className="option-name">{workType}</span>
                    <span className="option-count">({getCounts.workTypeCounts[workType] || 0})</span>
                  </span>
                </label>
              ))}
              {availableWorkTypes.length > 10 && (
                <details className="more-options">
                  <summary>Show {availableWorkTypes.length - 10} more...</summary>
                  <div className="filter-options">
                    {availableWorkTypes.slice(10).map(workType => (
                      <label key={workType} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={filters.workTypes.includes(workType)}
                          onChange={() => toggleWorkType(workType)}
                        />
                        <span className="filter-option-text">
                          <span className="option-name">{workType}</span>
                          <span className="option-count">({getCounts.workTypeCounts[workType] || 0})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Schedule Type */}
          <div className="filter-section">
            <label className="filter-label">
              ⏰ Schedule
              {filters.scheduleTypes.length > 0 && (
                <span className="filter-count">({filters.scheduleTypes.length} of {SCHEDULE_OPTIONS.length})</span>
              )}
            </label>
            <div className="filter-options">
              {SCHEDULE_OPTIONS.map(schedule => (
                <label key={schedule} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.scheduleTypes.includes(schedule)}
                    onChange={() => toggleScheduleType(schedule)}
                  />
                  <span className="filter-option-text">
                    <span className="option-name">{schedule}</span>
                    <span className="option-count">({getCounts.scheduleCounts[schedule] || 0})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="filter-section">
            <label className="filter-label">
              ⏱️ Duration
              {filters.durations.length > 0 && (
                <span className="filter-count">({filters.durations.length} of {DURATION_OPTIONS.length})</span>
              )}
            </label>
            <div className="filter-options">
              {DURATION_OPTIONS.map(duration => (
                <label key={duration} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.durations.includes(duration)}
                    onChange={() => toggleDuration(duration)}
                  />
                  <span className="filter-option-text">
                    <span className="option-name">{duration}</span>
                    <span className="option-count">({getCounts.durationCounts[duration] || 0})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Impact Level */}
          <div className="filter-section">
            <label className="filter-label">
              📊 Impact Level
              {filters.impactLevels.length > 0 && (
                <span className="filter-count">({filters.impactLevels.length} of {IMPACT_OPTIONS.length})</span>
              )}
            </label>
            <div className="filter-options">
              {IMPACT_OPTIONS.map(level => (
                <label key={level} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.impactLevels.includes(level)}
                    onChange={() => toggleImpactLevel(level)}
                  />
                  <span className="filter-option-text">
                    <span className="option-name">{level}</span>
                    <span className="option-count">({getCounts.impactCounts[level] || 0})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
