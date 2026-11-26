import pandas as pd

df = pd.read_csv("languages_enriched_all.csv")

# Anything that wasn't an exact match
df_non_exact = df[df["Match Type"] != "exact"]

df_exact = df[df["Match Type"] == "exact"]

df_non_exact.to_csv(
    "languages_needs_review.csv",
    index=False
)

df_exact.to_csv(
    "languages_enriched_exact.csv",
    index=False
)

print(f"{len(df_non_exact)} languages need review")