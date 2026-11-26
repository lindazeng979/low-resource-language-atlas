import { countryName, familyPath, fmt } from "../data/atlas.js";
import { AES_LABELS, CLASS_LABELS, CLASS_RAMP, DOC_LABELS, DOC_RAMP, ENDANGER_RAMP, SYSTEMS } from "../map/layers.js";

/**
 * Everything the atlas knows about one language, each field labelled with
 * where it came from. Grew out of the June prototype's side panel, whose
 * "Resource level / Endangerment / Common Voice / How researchers can help"
 * slots were placeholders; they are filled from real sources here.
 */
export default function LanguagePanel({ atlas, language, onClose }) {
  if (!language) return null;
  const path = familyPath(atlas, language);
  const sections = language.littauer.map((i) => atlas.littauer.sections[i]);
  const supported = SYSTEMS.filter((s) => language.coverage.has(s.id));
  const gaps = gapsFor(language, supported);
  const shareUrl = `${location.origin}${location.pathname}?lang=${language.glottocode}#explore`;

  return (
    <aside className="panel" aria-labelledby="panel-title">
      <header className="panel__head">
        <div>
          <p className="eyebrow">{language.familyName ?? (language.isIsolate ? "Language isolate" : "Unclassified")}</p>
          <h3 id="panel-title">{language.name}</h3>
          <p className="panel__codes">
            <code title="Glottocode">{language.glottocode}</code>
            {language.iso639_3 && <code title="ISO 639-3">{language.iso639_3}</code>}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close language details">
          ×
        </button>
      </header>

      <dl className="facts">
        <Fact label="Speakers" source={language.speakers ? sourceLink(language) : null}>
          {language.speakers ? (
            <>
              {fmt.format(language.speakers)}
              {language.speakersYear ? <span className="muted"> ({language.speakersYear})</span> : null}
            </>
          ) : (
            <span className="muted">No figure on Wikidata</span>
          )}
        </Fact>
        <Fact label="Endangerment" source={<a href={`https://glottolog.org/resource/languoid/id/${language.glottocode}`}>Glottolog</a>}>
          {language.endangerment ? (
            <span className="chip" style={{ "--chip": ENDANGER_RAMP[language.endangerment] ?? "#6f7d94" }}>
              {AES_LABELS[language.endangerment]}
            </span>
          ) : (
            <span className="muted">Unknown</span>
          )}
        </Fact>
        <Fact label="Documentation" source={<a href={`https://glottolog.org/resource/languoid/id/${language.glottocode}`}>Glottolog</a>}>
          {language.documentation != null ? (
            <span className="chip" style={{ "--chip": DOC_RAMP[language.documentation] }}>
              {DOC_LABELS[language.documentation]}
            </span>
          ) : (
            <span className="muted">Not assessed</span>
          )}
        </Fact>
        <Fact label="NLP resource class" source={<a href="https://aclanthology.org/2020.acl-main.560/">Joshi et al. 2020</a>}>
          {language.resourceClass != null ? (
            <span className="chip" style={{ "--chip": CLASS_RAMP[language.resourceClass] }}>
              {language.resourceClass} · {CLASS_LABELS[language.resourceClass]}
            </span>
          ) : (
            <span className="muted">Not in the study</span>
          )}
        </Fact>
        <Fact label="Wikipedia" source={language.wikipedia ? <a href={`https://${language.wikipedia.code}.wikipedia.org`}>{language.wikipedia.code}.wikipedia.org</a> : null}>
          {language.wikipedia ? `${fmt.format(language.wikipedia.articles)} articles` : <span className="muted">No edition</span>}
        </Fact>
        <Fact label="Where" source={<a href="https://glottolog.org">Glottolog</a>}>
          {language.countries.length ? language.countries.map(countryName).join(", ") : <span className="muted">Not recorded</span>}
        </Fact>
      </dl>

      <section className="panel__block">
        <h4>Supported by</h4>
        <ul className="support">
          {SYSTEMS.map((s) => (
            <li key={s.id} data-on={language.coverage.has(s.id) ? "" : undefined} title={s.long}>
              <span aria-hidden="true">{language.coverage.has(s.id) ? "●" : "○"}</span> {s.short}
              <span className="sr-only">{language.coverage.has(s.id) ? ": yes" : ": no"}</span>
            </li>
          ))}
        </ul>
      </section>

      {path.length > 0 && (
        <section className="panel__block">
          <h4>Family tree</h4>
          <ol className="lineage">
            {path.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
            <li aria-current="true">{language.name}</li>
          </ol>
        </section>
      )}

      {sections.length > 0 && (
        <section className="panel__block">
          <h4>
            Tools in Littauer's list <span className="muted">(CC-BY-SA)</span>
          </h4>
          {sections.map((section) => (
            <div key={section.h} className="lt">
              {section.note && <p className="small muted">{section.note}</p>}
              <ul>
                {section.e.map((entry, i) => (
                  <li key={i}>
                    {entry.u ? <a href={entry.u}>{entry.t}</a> : <span>{entry.t}</span>}
                    {entry.s && <span className="tag">{entry.s}</span>}
                    {entry.d && <span className="small muted"> {entry.d}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="panel__block">
        <h4>Where help is needed</h4>
        <ul className="gaps">
          {gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>

      <section className="panel__block panel__links">
        <h4>Look further</h4>
        <p>
          <a href={`https://glottolog.org/resource/languoid/id/${language.glottocode}`}>Glottolog</a>
          {language.wikidata && <a href={`https://www.wikidata.org/wiki/${language.wikidata}`}>Wikidata</a>}
          {language.iso639_3 && <a href={`http://www.language-archives.org/language/${language.iso639_3}`}>OLAC archives</a>}
          {language.iso639_3 && <a href={`https://huggingface.co/datasets?language=language:${language.iso639_3}`}>Hugging Face datasets</a>}
        </p>
        <button className="link-btn" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
          Copy link to {language.name}
        </button>
      </section>
    </aside>
  );
}

function Fact({ label, source, children }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        {children}
        {source && <span className="fact__src">{source}</span>}
      </dd>
    </div>
  );
}

function sourceLink(language) {
  if (language.wikidata) return <a href={`https://www.wikidata.org/wiki/${language.wikidata}#P1098`}>Wikidata</a>;
  return "Wikidata";
}

/**
 * Plain-language next steps derived only from what the data shows is missing.
 * Never claims anything the sources do not support.
 */
function gapsFor(language, supported) {
  const gaps = [];
  const has = (id) => supported.some((s) => s.id === id);
  if (language.endangerment === 6) {
    return ["Glottolog lists this language as extinct (no first-language speakers). Archival records and any revitalisation efforts matter most here."];
  }
  if (language.documentation != null && language.documentation >= 3) {
    gaps.push("Basic description: no grammar or grammar sketch has been published.");
  }
  if (!has("gt") && !has("nllb")) gaps.push("Translation: no machine translation system in this atlas supports it.");
  if (!has("mms_asr") && !has("cv")) gaps.push("Speech: no open speech recognition model or Common Voice dataset.");
  if (!has("wp")) gaps.push("Text online: no Wikipedia edition, a common source of training text.");
  if (language.endangerment >= 3 && language.endangerment <= 5) {
    gaps.push("Transmission: the language is not being passed fully to children. Community-led revitalisation comes first; technology can support it.");
  }
  if (!language.speakers) gaps.push("Basic facts: Wikidata has no speaker count to cite.");
  if (gaps.length === 0) gaps.push("Well covered by the tools tracked here. Quality may still lag: coverage is not the same as good performance.");
  return gaps;
}
