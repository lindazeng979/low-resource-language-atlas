import pandas as pd

# Load your enriched language file
df = pd.read_csv("languages_enriched_exact.csv")

# Load full Glottolog file
df_glotto = pd.read_csv("glottolog_languoid.csv")
df_glotto.columns = df_glotto.columns.str.strip()

# Build ID -> name lookup from all Glottolog rows
id_to_name = dict(zip(df_glotto["id"], df_glotto["name"]))

# Add readable family/parent names
df["Family Name"] = df["Family ID"].map(id_to_name)
df["Parent Name"] = df["Parent ID"].map(id_to_name)

# Optional: handle isolates like Basque, where Family ID is blank
df["Family Name"] = df["Family Name"].fillna("Isolate / Unknown")
df["Parent Name"] = df["Parent Name"].fillna("None")

# Save new enriched version
df.to_csv("languages_enriched_with_families.csv", index=False)

print(df[[
    "Input Name",
    "Matched Name",
    "Family ID",
    "Family Name",
    "Parent ID",
    "Parent Name"
]].head(20))

print("Saved to languages_enriched_with_families.csv")