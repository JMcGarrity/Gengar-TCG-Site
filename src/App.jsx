/*
  PURPOSE: Displays Pokemon TCG Gengar cards with prices.
  - Fetches ALL Gengar cards from the free Pokemon TCG API on load
  - Builds a dropdown of expansion sets, populated only with sets that
    actually contain a Gengar card (no manual set list needed)
  - Detects which PRINT VARIANTS each card actually has (normal,
    holofoil, reverse holofoil, etc.) using the API's tcgplayer pricing
    data, and renders one priced tile per variant — since a single card
    like "Gengar 151" can have a holo and a reverse holo as separate
    collectibles with different values
  - Fetches PRICES from a WordPress site's REST API, keyed by
    cardId + variant, so each variant can be priced independently
  - Shows a "Top 3" section pulling the 3 highest priced card+variant
    combinations returned by WordPress
  - Selecting a set filters the grid to show only Gengar cards from that set
  - Falls back to a local priceData.js file if WordPress is unreachable,
    so the site still works even if the WP backend is down or not yet set up
*/
import { useState, useEffect } from "react";
import fallbackPriceData from "./priceData";
import "./App.css";

// Change this to your own WordPress site's URL once it's set up.
// Must point at a WordPress install with the Gengar Card Price Manager
// plugin (included in /wordpress-plugin) active.
const WP_API_URL = "http://gengar-tcg-site.local/wp-json/wp/v2/gengar_card?per_page=100";

// Human-readable labels for the variant keys the Pokemon TCG API uses.
// Not every card has all of these — we only show variants a card actually has.
const VARIANT_LABELS = {
  normal: "Normal",
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse Holo",
  "1stEditionNormal": "1st Edition",
  "1stEditionHolofoil": "1st Edition Holo",
};

// Given a card object from the API, returns an array of variant keys
// that actually exist for it (e.g. ["holofoil", "reverseHolofoil"]).
// This comes from the card's tcgplayer pricing data — whichever keys
// are present there represent real, distinct printed versions of the card.
// Falls back to ["normal"] if a card has no tcgplayer pricing info at all,
// so older/obscure cards still render one tile instead of none.
function getCardVariants(card) {
  const prices = card.tcgplayer?.prices;
  if (!prices) return ["normal"];
  const variants = Object.keys(prices);
  return variants.length > 0 ? variants : ["normal"];
}

// Builds the lookup key used in priceData for a specific card + variant
// combination, e.g. "sv3pt5-151::reverseHolofoil"
function priceKey(cardId, variant) {
  return `${cardId}::${variant}`;
}

export default function App() {
  // allCards: every Gengar card returned by the API, unfiltered
  // loading: tracks whether the initial fetch is still in progress
  // error: stores a message if the fetch fails, so we can show it instead of a blank page
  // selectedSet: which set the dropdown currently has chosen ("" = show top 3 / default view)
  const [allCards, setAllCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSet, setSelectedSet] = useState("");
  const [priceData, setPriceData] = useState({});
  const [priceSource, setPriceSource] = useState("loading"); // "wordpress" | "fallback" | "loading"

  // Runs once on mount: fetch prices from WordPress.
  // WordPress returns one object per "Gengar Card" post, each with
  // card_id, variant, and price fields (exposed via register_rest_field
  // in the plugin). We convert that array into a lookup object keyed by
  // "cardId::variant", matching the shape of the local fallback file so
  // the rest of the component doesn't need to know which source it came from.
  useEffect(() => {
    fetch(WP_API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`WordPress API responded with ${res.status}`);
        return res.json();
      })
      .then((posts) => {
        const priceMap = {};
        posts.forEach((post) => {
          if (post.card_id) {
            // WordPress/ACF can return price as a string (e.g. "14.00")
            // depending on field configuration - Number() converts it to
            // an actual number so our typeof === "number" checks work
            // regardless of which format it arrives in.
            const numericPrice = Number(post.price);

            // .trim() guards against accidental leading/trailing spaces
            // typed into the WordPress admin fields, which would otherwise
            // silently break the lookup (e.g. "sv3pt5-94 " !== "sv3pt5-94")
            const cardId = post.card_id.trim();
            const variant = (post.variant || "normal").trim();

            if (!isNaN(numericPrice)) {
              priceMap[priceKey(cardId, variant)] = numericPrice;
            }
          }
        });
        console.log("Price map built:", priceMap);
        setPriceData(priceMap);
        setPriceSource("wordpress");
      })
      .catch((err) => {
        // If WordPress isn't reachable (not set up yet, site is down, wrong
        // URL, etc.), fall back to the static local file so the site still
        // works rather than showing no prices at all.
        console.warn("Couldn't reach WordPress, using local fallback prices:", err);
        setPriceData(fallbackPriceData);
        setPriceSource("fallback");
      });
  }, []);

  // Runs once when the component mounts (empty dependency array).
  // Fetches every card with "gengar" in the name, across all sets.
  useEffect(() => {
    fetch("https://api.pokemontcg.io/v2/cards?q=name:gengar&pageSize=250")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API responded with status ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        setAllCards(json.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch cards:", err);
        setError("Couldn't load card data. Please try again later.");
        setLoading(false);
      });
  }, []);

  // Build a de-duplicated, alphabetically sorted list of set names that
  // actually contain a Gengar card — this drives the dropdown options.
  // We don't hardcode this list; it's derived directly from the fetched data.
  const setNames = [...new Set(allCards.map((card) => card.set.name))].sort();

  // Cards to show in the grid: either everything in the selected set,
  // or nothing if no set has been chosen yet.
  const cardsInSelectedSet = selectedSet
    ? allCards.filter((card) => card.set.name === selectedSet)
    : [];

  // Build the "Top 3" list. Since a single card can have multiple variants
  // (normal, holofoil, reverse holo...), we first flatten every card into
  // one entry PER variant, attach that variant's price, then sort/slice
  // across all of those combined — so the true 3 highest-value items show,
  // even if they're different variants of the same card.
  const allCardVariants = allCards.flatMap((card) =>
    getCardVariants(card).map((variant) => ({
      card,
      variant,
      price: priceData[priceKey(card.id, variant)],
    }))
  );

  const topThree = allCardVariants
    .filter((entry) => typeof entry.price === "number")
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);

  if (loading) {
    return <div className="status-message">Loading Gengar cards...</div>;
  }

  if (error) {
    return <div className="status-message error">{error}</div>;
  }

  return (
    <div className="app">
      <header className="hero">
        <h1>Gengar TCG Price Guide</h1>
        <p>Browse every Gengar card across {setNames.length} expansion sets</p>
        {priceSource === "fallback" && (
          <p className="source-note">
            ⚠ Using local fallback prices — WordPress price source unreachable
          </p>
        )}
        {priceSource === "wordpress" && (
          <p className="source-note source-note-ok">
            ✓ Prices live from WordPress
          </p>
        )}
      </header>

      {/* TOP 3 SECTION — only renders once you've added prices in WordPress (or the fallback file) */}
      <section className="top-three">
        <h2>Top 3 Cards</h2>
        {topThree.length === 0 ? (
          <p className="placeholder-note">
            No prices added yet — add some Gengar Card posts in WordPress
            (or edit <code>src/priceData.js</code>) to populate this section.
          </p>
        ) : (
          <div className="card-grid">
            {topThree.map((entry) => (
              <CardTile
                key={priceKey(entry.card.id, entry.variant)}
                card={entry.card}
                variant={entry.variant}
                price={entry.price}
              />
            ))}
          </div>
        )}
      </section>

      {/* SET SELECTOR */}
      <section className="set-browser">
        <h2>Browse by Set</h2>
        <select
          value={selectedSet}
          onChange={(e) => setSelectedSet(e.target.value)}
        >
          <option value="">-- Choose a set --</option>
          {setNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {selectedSet && (
          <div className="card-grid">
            {cardsInSelectedSet.flatMap((card) =>
              getCardVariants(card).map((variant) => (
                <CardTile
                  key={priceKey(card.id, variant)}
                  card={card}
                  variant={variant}
                  price={priceData[priceKey(card.id, variant)]}
                />
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// Small reusable component for displaying a single card+variant tile.
// Shows the image, name, set, variant label (e.g. "Reverse Holo"),
// a user-friendly card number (e.g. "H9/30"), price (or "Price not set"),
// and the API's internal ID so it's easy to copy into WordPress.
function CardTile({ card, variant, price }) {
  // card.number is the card's number within its set (e.g. "H9")
  // card.set.printedTotal is how many cards are in that set (e.g. 30)
  // Combining them gives the familiar "H9/30" format collectors recognize,
  // without needing to hardcode set sizes anywhere ourselves.
  const friendlyNumber = `${card.number}/${card.set.printedTotal}`;
  const variantLabel = VARIANT_LABELS[variant] || variant;

  return (
    <div className="card-tile">
      <img src={card.images.small} alt={card.name} />
      <h3>{card.name}</h3>
      <p className="set-name">{card.set.name}</p>
      <p className="card-number">{friendlyNumber}</p>
      <p className="variant-label">{variantLabel}</p>
      <p className="price">
        {typeof price === "number" ? `$${price.toFixed(2)}` : "Price not set"}
      </p>
      <p className="card-id">
        WordPress Card ID: {card.id} &nbsp;|&nbsp; Variant: {variant}
      </p>
    </div>
  );
}
