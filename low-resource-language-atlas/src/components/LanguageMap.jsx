import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

function LanguageMap({ familyFilter, countryFilter, onOpenDetails }) {
  const [languages, setLanguages] = useState([]);

  useEffect(() => {
    fetch("/languages.json")
      .then((r) => r.json())
      .then(setLanguages);
  }, []);

  const filteredLanguages = languages.filter((lang) => {
    const langFamily = lang.family_name || "Unknown";
    const countryList = Array.isArray(lang.countries) ? lang.countries : [];

    const familyMatch =
      familyFilter === "All" || langFamily === familyFilter;

    const countryMatch =
      countryFilter === "All" || countryList.includes(countryFilter);

    return familyMatch && countryMatch;
  });

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: "100vh", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {filteredLanguages.map((lang) => {
        const countryList = Array.isArray(lang.countries) ? lang.countries : [];

        return (
          <CircleMarker
            key={lang.glottocode}
            center={[lang.latitude, lang.longitude]}
            radius={6}
            /*eventHandlers={{
              mouseover: (e) => {
                e.target.openPopup();
              },
              mouseout: (e) => {
                e.target.closePopup();
              }
            }}*/
          >
            <Popup>
              <h3>{lang.input_name || lang.name}</h3>
              <p>Family: {lang.family_name || "Unknown"}</p>
              <p>ISO: {lang.iso639_3 || "Unknown"}</p>
              <p>Countries: {countryList.join(", ") || "Unknown"}</p>

              <button
                type="button"
                onClick={() => onOpenDetails(lang)}
              >
                View full profile
              </button>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

export default LanguageMap;