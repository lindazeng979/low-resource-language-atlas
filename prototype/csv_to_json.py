import pandas as pd
import json

df = pd.read_csv("languages_enriched_with_families_and_countries.csv")

df["Countries"] = df["Countries"].apply(
    lambda x: str(x).split(" ") if pd.notna(x) else []
)

df["Country Names"] = df["Country Names"].apply(
    lambda x: str(x).split("; ") if pd.notna(x) else []
)

# clean column names for JS
df = df.rename(columns={
    "Input Name": "input_name",
    "Matched Name": "name",
    "Match Type": "match_type",
    "Glottocode": "glottocode",
    "ISO639_3": "iso639_3",
    "Family ID": "family_id",
    "Family Name": "family_name",
    "Parent ID": "parent_id",
    "Parent Name": "parent_name",
    "Latitude": "latitude",
    "Longitude": "longitude",
    "Countries": "country_codes",
    "Country Names": "countries",
})

# keep only rows with map coordinates
df = df[df["latitude"].notna() & df["longitude"].notna()].copy()

# add placeholder fields for later filters
df["resource_level"] = "unknown"
df["endangerment_status"] = "unknown"
df["speaker_count"] = None
df["has_common_voice"] = False
df["notes"] = ""

# convert NaN -> null for JSON
# records = df.to_dict(orient="records")
records = json.loads(
    df.to_json(orient="records")
)

with open("low-resource-language-atlas/public/languages.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Saved {len(records)} languages to low-resource-language-atlas/public/languages.json")