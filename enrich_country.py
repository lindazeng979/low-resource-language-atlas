import pandas as pd
import pycountry

df = pd.read_csv("languages_enriched_with_families.csv")

def codes_to_names(country_codes):
    if pd.isna(country_codes):
        return ""

    names = []
    for code in str(country_codes).split():
        country = pycountry.countries.get(alpha_2=code)
        if country:
            names.append(country.name)
        else:
            names.append(code)

    return "; ".join(names)

df["Country Names"] = df["Countries"].apply(codes_to_names)

df.to_csv("languages_enriched_with_families_and_countries.csv", index=False)