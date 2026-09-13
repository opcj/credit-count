"use client";
import { useMemo, useState } from "react";
import { Search, MapPin, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { countryName, type Coaster } from "@/lib/domain";
import { Button, EmptyState, Modal } from "./ui";
import { RideComposer } from "./ride-composer";
import { CoasterArt } from "./brand";
import { useDialogSession } from "./use-dialog-session";

export function Catalogue({ coasters }: { coasters: Coaster[] }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const logger = useDialogSession<Coaster>();
  const selected = logger.session;
  const countries = useMemo(
    () =>
      [...new Set(coasters.map((c) => c.country_code))].sort((a, b) =>
        countryName(a).localeCompare(countryName(b)),
      ),
    [coasters],
  );
  const manufacturers = useMemo(
    () => [...new Set(coasters.map((c) => c.manufacturer))].sort(),
    [coasters],
  );
  const results = coasters.filter(
    (c) =>
      `${c.name} ${c.park}`.toLowerCase().includes(query.toLowerCase()) &&
      (!country || c.country_code === country) &&
      (!type || c.type === type) &&
      (!manufacturer || c.manufacturer === manufacturer),
  );
  function reset() {
    setQuery("");
    setCountry("");
    setType("");
    setManufacturer("");
  }
  return (
    <>
      <div className="card catalogue-toolbar">
        <div className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search the catalogue"
            placeholder="Find a coaster or a park…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter-row">
          <span className="filter-label">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Explore by
          </span>
          <select
            aria-label="Filter by country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          >
            <option value="">All manufacturers</option>
            {manufacturers.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            aria-label="Filter by type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            <option value="steel">Steel</option>
            <option value="wooden">Wooden</option>
            <option value="hybrid">Hybrid</option>
          </select>
          {(query || country || type || manufacturer) && (
            <button className="text-button" onClick={reset}>
              Clear filters
            </button>
          )}
        </div>
      </div>
      <p className="results-caption" role="status">
        {results.length} {results.length === 1 ? "coaster" : "coasters"} to
        discover
      </p>
      {results.length ? (
        <div className="catalogue-grid">
          {results.map((c) => (
            <article className="card coaster-card" key={c.id}>
              <div className={`coaster-card-top type-${c.type}`}>
                <CoasterArt type={c.type} />
                <span className="type-badge">{c.type}</span>
              </div>
              <div className="coaster-card-body">
                <small className="coaster-country">
                  <MapPin size={12} aria-hidden="true" />
                  {countryName(c.country_code)}
                </small>
                <h2>{c.name}</h2>
                <p>{c.park}</p>
                <div className="coaster-card-bottom">
                  <small>{c.manufacturer}</small>
                  <Button
                    variant="ghost"
                    onClick={() => logger.open(c)}
                    aria-label={`Log a ride on ${c.name}`}
                  >
                    Log ride <ArrowUpRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Search />} title="No coasters on this track">
          Try another search or clear your filters.
        </EmptyState>
      )}
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && selected) logger.close(selected);
        }}
        title="Another ride to remember"
        description="Every ride is a new memory. First-time coasters add a credit, too."
      >
        {selected && (
          <RideComposer
            key={selected.key}
            coasters={coasters}
            initialCoasterId={selected.value.id}
            onSaved={() => logger.close(selected)}
          />
        )}
      </Modal>
    </>
  );
}
