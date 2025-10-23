import { useEffect } from 'react';
import type { Disruption } from '../store/disruptions';
import './DisruptionDetailsModal.css';

interface DisruptionDetailsModalProps {
  disruption: Disruption | null;
  onClose: () => void;
}

export function DisruptionDetailsModal({ disruption, onClose }: DisruptionDetailsModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (disruption) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [disruption, onClose]);

  if (!disruption) return null;

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-section">
            <h2>{disruption.title}</h2>
            <div className="modal-badges">
              <span className={`severity-badge ${disruption.severity}`}>
                {disruption.severity}
              </span>
              {disruption.type && (
                <span className="type-badge">{disruption.type}</span>
              )}
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Description */}
          <section className="detail-section">
            <h3>📋 Description</h3>
            <p>{disruption.description}</p>
          </section>

          {/* On-Site Hours */}
          {disruption.onsiteHours && (
            <section className="detail-section highlight">
              <h3>🕐 On-Site Hours</h3>
              <p className="onsite-hours">{disruption.onsiteHours}</p>
            </section>
          )}

          {/* Schedule & Duration */}
          <section className="detail-section">
            <h3>⏰ Schedule & Duration</h3>
            <div className="info-grid">
              {disruption.scheduleType && (
                <div className="info-item">
                  <span className="info-label">Schedule:</span>
                  <span className="info-value">{disruption.scheduleType}</span>
                </div>
              )}
              {disruption.duration && (
                <div className="info-item">
                  <span className="info-label">Duration:</span>
                  <span className="info-value">{disruption.duration}</span>
                </div>
              )}
              {disruption.activePeriod?.start && (
                <div className="info-item">
                  <span className="info-label">Start:</span>
                  <span className="info-value">{formatDate(disruption.activePeriod.start)}</span>
                </div>
              )}
              {disruption.activePeriod?.end && (
                <div className="info-item">
                  <span className="info-label">End:</span>
                  <span className="info-value">{formatDate(disruption.activePeriod.end)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Address Information (TCL) */}
          {disruption.addressFull && (
            <section className="detail-section highlight">
              <h3>📍 Precise Address</h3>
              <p className="address-full">{disruption.addressFull}</p>
              {disruption.tclMatches && disruption.tclMatches.length > 0 && (
                <div className="tcl-matches">
                  {disruption.tclMatches.map((match, idx) => (
                    <div key={idx} className="tcl-match-item">
                      <span className="tcl-street">{match.street_name}</span>
                      {match.address_range && (
                        <span className="tcl-range"> ({match.address_range})</span>
                      )}
                      <span className={`tcl-confidence ${match.match_type}`}>
                        {match.match_type === 'exact' ? '✓ Exact' : '≈ Fuzzy'} ({(match.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Location & Work Details */}
          <section className="detail-section">
            <h3>�️ Location & Work Details</h3>
            <div className="info-grid">
              {disruption.district && (
                <div className="info-item">
                  <span className="info-label">District:</span>
                  <span className="info-value">{disruption.district}</span>
                </div>
              )}
              {disruption.roadClass && (
                <div className="info-item">
                  <span className="info-label">Road Class:</span>
                  <span className="info-value">{disruption.roadClass}</span>
                </div>
              )}
              {disruption.workType && (
                <div className="info-item">
                  <span className="info-label">Work Type:</span>
                  <span className="info-value">{disruption.workType}</span>
                </div>
              )}
              {disruption.contractor && (
                <div className="info-item">
                  <span className="info-label">Contractor:</span>
                  <span className="info-value">{disruption.contractor}</span>
                </div>
              )}
              {disruption.impactLevel && (
                <div className="info-item">
                  <span className="info-label">Impact Level:</span>
                  <span className="info-value impact-badge">{disruption.impactLevel}</span>
                </div>
              )}
              {disruption.direction && (
                <div className="info-item">
                  <span className="info-label">Direction:</span>
                  <span className="info-value">{disruption.direction}</span>
                </div>
              )}
            </div>
          </section>

          {/* Affected Lines (for transit) */}
          {disruption.affectedLines && disruption.affectedLines.length > 0 && (
            <section className="detail-section">
              <h3>🚇 Affected Lines</h3>
              <div className="affected-lines">
                {disruption.affectedLines.map((line, idx) => (
                  <span key={idx} className="line-badge">{line}</span>
                ))}
              </div>
            </section>
          )}

          {/* Additional Info */}
          {disruption.url && (
            <section className="detail-section">
              <h3>🔗 More Information</h3>
              <a 
                href={disruption.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="external-link"
              >
                View Official Update ↗
              </a>
            </section>
          )}

          {/* Metadata */}
          <section className="detail-section metadata">
            <div className="info-grid">
              {disruption.sourceApi && (
                <div className="info-item">
                  <span className="info-label">Source:</span>
                  <span className="info-value">{disruption.sourceApi}</span>
                </div>
              )}
              {disruption.lastFetchedAt && (
                <div className="info-item">
                  <span className="info-label">Last Updated:</span>
                  <span className="info-value">{formatDate(disruption.lastFetchedAt)}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button className="close-footer-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
