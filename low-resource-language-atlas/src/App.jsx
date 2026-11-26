import { useEffect, useState } from "react";
import "./App.css";
import LanguageMap from "./components/LanguageMap";

function App() {
  const [languages, setLanguages] = useState([]);
  const [familyFilter, setFamilyFilter] = useState("All");
  const [countryFilter, setCountryFilter] = useState("All");
  const [selectedLanguage, setSelectedLanguage] = useState(null);

  useEffect(() => {
    fetch("/languages.json")
      .then((r) => r.json())
      .then(setLanguages);
  }, []);

  const families = [
    "All",
    ...new Set(languages.map((lang) => lang.family_name || "Unknown").sort()),
  ];

  const countries = [
    "All",
    ...new Set(
      languages
        .flatMap((lang) => (Array.isArray(lang.countries) ? lang.countries : []))
        .filter(Boolean)
        .sort()
    ),
  ];

  return (
    <div className="App">
      <h1>Low-Resource Language Atlas</h1>

      <div className="filters">
        <select value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}>
          {families.map((family) => (
            <option key={family} value={family}>{family}</option>
          ))}
        </select>

        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          {countries.map((country) => (
            <option key={country} value={country}>{country}</option>
          ))}
        </select>
      </div>

      <div className="main-layout">
        <div className="map-area">
          <LanguageMap
            familyFilter={familyFilter}
            countryFilter={countryFilter}
            onOpenDetails={setSelectedLanguage}
          />
        </div>

        {selectedLanguage && (
          <aside className="side-panel">
            <button onClick={() => setSelectedLanguage(null)}>Close</button>

            <h2>{selectedLanguage.input_name || selectedLanguage.name}</h2>
            <p><strong>Matched name:</strong> {selectedLanguage.name || "Unknown"}</p>
            <p><strong>Family:</strong> {selectedLanguage.family_name || "Unknown"}</p>
            <p><strong>Parent:</strong> {selectedLanguage.parent_name || "Unknown"}</p>
            <p><strong>ISO 639-3:</strong> {selectedLanguage.iso639_3 || "Unknown"}</p>
            <p><strong>Glottocode:</strong> {selectedLanguage.glottocode || "Unknown"}</p>
            <p>
              <strong>Countries:</strong>{" "}
              {Array.isArray(selectedLanguage.countries)
                ? selectedLanguage.countries.join(", ")
                : "Unknown"}
            </p>

            <h3>Resource Status</h3>
            <p><strong>Resource level:</strong> {selectedLanguage.resource_level || "unknown"}</p>
            <p><strong>Endangerment:</strong> {selectedLanguage.endangerment_status || "unknown"}</p>
            <p><strong>Common Voice:</strong> {selectedLanguage.has_common_voice ? "Yes" : "No"}</p>

            <h3>How researchers can help</h3>
            <p>
              {selectedLanguage.notes ||
                "Needs data, documentation, speech resources, and community-specific tooling."}
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;