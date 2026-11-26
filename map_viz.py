import pandas as pd
import folium

cols = [
    "id", "family_id", "parent_id", "name", "bookkeeping",
    "level", "latitude", "longitude", "iso639_3",
    "hid", "description", "child_family_count",
    "child_language_count", "child_dialect_count", "countries"
]

df = pd.read_csv("glottolog_languoid.csv", names=cols)

# Keep only language entries with coordinates
df_map = df[
    (df["level"] == "language") &
    df["latitude"].notna() &
    df["longitude"].notna()
].copy()

# Create map
m = folium.Map(location=[10, 20], zoom_start=2)

for _, row in df_map.iterrows():
    folium.CircleMarker(
        location=[row["latitude"], row["longitude"]],
        radius=2,
        popup=f"{row['name']} ({row['id']})<br>ISO: {row['iso639_3']}<br>{row['countries']}",
        fill=True
    ).add_to(m)

m.save("glottolog_languages_map.html")