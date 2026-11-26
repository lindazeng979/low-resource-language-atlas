import pandas as pd
import difflib

# Load Glottolog
df_glotto = pd.read_csv("glottolog_languoid.csv")

# Clean column names just in case
df_glotto.columns = df_glotto.columns.str.strip()

# Only language-level entries
df_languages = df_glotto[df_glotto["level"] == "language"].copy()

# Your language list
my_languages = (
    pd.read_csv("languages_seed.csv")["Language Name"]
    .dropna()
    .astype(str)
    .tolist()
)

def find_language_info(name, df):
    name_clean = name.strip()

    # Exact match
    match = df[df["name"].str.lower() == name_clean.lower()]

    match_type = "exact"

    # Fuzzy match if needed
    if match.empty:
        close_matches = difflib.get_close_matches(
            name_clean,
            df["name"].dropna().tolist(),
            n=1,
            cutoff=0.7
        )

        if close_matches:
            match = df[df["name"] == close_matches[0]]
            match_type = "fuzzy"

    if not match.empty:
        row = match.iloc[0]

        return {
            "Input Name": name_clean,
            "Matched Name": row["name"],
            "Match Type": match_type,
            "Glottocode": row["id"],
            "ISO639_3": row["iso639P3code"],
            "Family ID": row["family_id"],
            "Parent ID": row["parent_id"],
            "Latitude": row["latitude"],
            "Longitude": row["longitude"],
            "Countries": row["country_ids"],
        }

    return {
        "Input Name": name_clean,
        "Matched Name": None,
        "Match Type": "none",
        "Glottocode": None,
        "ISO639_3": None,
        "Family ID": None,
        "Parent ID": None,
        "Latitude": None,
        "Longitude": None,
        "Countries": None,
    }

# Create new dataframe
df_language_lookup = pd.DataFrame(
    [find_language_info(lang, df_languages) for lang in my_languages]
)

print(df_language_lookup.head())

# Save
df_language_lookup.to_csv(
    "languages_enriched.csv",
    index=False
)