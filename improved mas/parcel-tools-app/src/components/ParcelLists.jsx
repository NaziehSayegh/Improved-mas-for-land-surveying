import React from 'react';
import { Edit, FileDown, Trash2 } from 'lucide-react';
import { parcelKey, formatArea, latestVersions, countVersions } from '../utils/parcelHelpers';

// One saved parcel: number, badges, area, curves and the edit / export / delete buttons.
// `badge` is the blue label next to the number; `showCorners` lists the corner point IDs underneath.
const ParcelCard = ({ parcel, badge, highlighted = false, showCorners = false, onEdit, onDelete, onExport, selected, onToggleSelect }) => {
  const curves = parcel.curves || [];
  return (
    <div className={`glass-effect rounded-lg p-5 hover:border-primary/50 transition-all group ${highlighted ? 'border-l-4 border-blue-500' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(parcel.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 mt-1 rounded border-dark-600 text-primary focus:ring-primary bg-dark-800 cursor-pointer accent-primary flex-shrink-0"
              title="Select item for multi-parcel export"
            />
          )}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-primary mb-2">
              Parcel #{parcel.number}
              {badge && (
                <span className="ml-2 text-xs px-2 py-1 bg-blue-600/20 border border-blue-500 rounded text-blue-400">
                  {badge}
                </span>
              )}
              {curves.length > 0 && (
                <span className="ml-2 text-xs px-2 py-1 bg-warning/20 border border-warning rounded text-warning">
                  📐 {curves.length} Curve(s)
                </span>
              )}
            </h3>
            <div className="flex gap-6 text-sm text-dark-300">
              <span>📐 Area: <strong className="text-success">{formatArea(parcel.area)} m²</strong></span>
              <span>📍 Points: {parcel.pointCount}</span>
            </div>
            {curves.length > 0 && (
              <div className="mt-2 text-xs text-warning">
                {curves.map((c, i) => (
                  <span key={i} className="mr-3">
                    {c.from}→{c.to}: M={c.M}{c.sign === 1 ? '(+)' : '(−)'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(parcel)}
            className="p-2 hover:bg-primary/20 rounded-lg text-primary"
            title="Load into editor"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExport(parcel); }}
            className="p-2 hover:bg-success/20 rounded-lg text-success"
            title="Export this single parcel as PDF"
          >
            <FileDown className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(parcel.id); }}
            className="p-2 hover:bg-danger/20 rounded-lg text-danger"
            title="Delete parcel"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showCorners && (
        <div className="mt-3 pt-3 border-t border-dark-600">
          <div className="flex flex-wrap gap-2 items-center">
            {(parcel.ids || []).map((id, idx) => (
              <div key={idx} className="bg-dark-800 border border-primary/30 rounded-lg px-3 py-2 text-primary font-semibold text-sm">
                {id}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// "Saved Parcels" tab: the latest version of each parcel number
export const UniqueParcelsList = React.memo(({ savedParcels, onEdit, onDelete, onExport, selectedIds = [], onToggleSelect }) => {
  if (savedParcels.length === 0) {
    return <p className="text-dark-400 text-center py-12">No saved parcels yet.</p>;
  }

  const { totals } = countVersions(savedParcels);

  return (
    <div className="space-y-3">
      {latestVersions(savedParcels).map((parcel) => {
        const versions = totals.get(parcelKey(parcel)) || 1;
        return (
          <ParcelCard
            key={parcel.id}
            parcel={parcel}
            badge={versions > 1 ? `📋 ${versions} version(s)` : null}
            showCorners
            onEdit={onEdit}
            onDelete={onDelete}
            onExport={onExport}
            selected={selectedIds.includes(parcel.id)}
            onToggleSelect={onToggleSelect}
          />
        );
      })}
    </div>
  );
});

// "All Versions" tab: every save, including repeated parcel numbers, with a search box
export const AllParcelsList = React.memo(({ savedParcels, onEdit, onDelete, onExport, selectedIds = [], onToggleSelect }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  if (savedParcels.length === 0) {
    return <p className="text-dark-400 text-center py-12">No saved parcels yet.</p>;
  }

  const { totals, versionOf } = countVersions(savedParcels);
  const query = searchQuery.trim().toLowerCase();
  const filteredParcels = query
    ? savedParcels.filter(parcel => parcelKey(parcel).includes(query))
    : savedParcels;

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search parcels by number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-dark-800 border border-dark-600 rounded-md px-4 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
          >
            &times;
          </button>
        )}
      </div>

      {filteredParcels.length === 0 ? (
        <p className="text-dark-400 text-center py-8">No parcels match your search.</p>
      ) : (
        <div className="space-y-3">
          {filteredParcels.map((parcel, rowIndex) => {
            const versions = totals.get(parcelKey(parcel)) || 1;
            const version = versionOf.get(parcel.id) || 1;
            const isLaterVersion = versions > 1 && version > 1;
            return (
              <ParcelCard
                key={`${parcel.id}-${rowIndex}`}
                parcel={parcel}
                badge={isLaterVersion ? `🔄 Version ${version} of ${versions}` : null}
                highlighted={isLaterVersion}
                onEdit={onEdit}
                onDelete={onDelete}
                onExport={onExport}
                selected={selectedIds.includes(parcel.id)}
                onToggleSelect={onToggleSelect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
