# Gengar TCG Price Guide

## Purpose

A purple/red themed site displaying Pokemon TCG Gengar cards with prices. Built to demonstrate skills directly relevant to a junior web developer role that combines WordPress and React: a **WordPress backend manages card prices as normal content** (via a custom post type), while a **React front end** fetches and displays that data alongside live card info pulled from an external API.

This mirrors a common real-world pattern: WordPress as a content/data management layer, React as the presentation layer consuming it via the REST API.

**Card data** (names, images, sets) comes from the free Pokemon TCG API - automatically, no manual entry needed, covering all ~60+ expansion sets.

**Price data** is managed through WordPress's admin screen, exposed via its REST API, and consumed by React. If WordPress isn't reachable, the app automatically falls back to a local static file so it never breaks.

---

## Software & Versions Used

| Software | Version Used | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ recommended | Required to run the React project locally |
| React | 18.2 | UI library for the front end |
| [Vite](https://vitejs.dev/) | 5.x | Build tool / dev server |
| [Pokemon TCG API](https://pokemontcg.io/) | v2 (free, no key required for basic use) | Source of all card data — names, images, sets |
| [Local](https://localwp.com/) | Latest | Local WordPress environment for the price-management backend |
| WordPress | 6.x | Manages card prices as a custom post type |
| [Advanced Custom Fields (ACF)](https://wordpress.org/plugins/advanced-custom-fields/) | Free version | Adds the `card_id` and `price` fields to each Gengar Card post |

---

## How to Run This Project

### Part 1: Set up the WordPress price backend

1. Install Local: https://localwp.com/
2. Create a new WordPress site
3. Install **Advanced Custom Fields**: Plugins → Add New → search "Advanced Custom Fields" → Install → Activate
4. Copy `wordpress-plugin/gengar-card-price-manager.php` into your Local site's `wp-content/plugins/` folder, inside its own subfolder, e.g. `wp-content/plugins/gengar-card-price-manager/gengar-card-price-manager.php`
5. In wp-admin, go to **Plugins** and activate "Gengar Card Price Manager"
6. You'll now see a **Gengar Cards** menu in wp-admin
7. Create the ACF field group to go with it:
   - Go to **Custom Fields → Add New**
   - Name it "Gengar Card Details"
   - Add a **Text** field labeled `Card ID` (field name: `card_id`)
   - Add a **Number** field labeled `Price` (field name: `price`)
   - Under Location Rules: Post Type is equal to Gengar Card
   - **Important**: scroll to this field group's settings and ensure "Show in REST API" is enabled (in newer ACF versions this is a setting on the field group itself) — this is what makes the values visible to React
   - Publish
8. Add a few Gengar Card posts: **Gengar Cards → Add New**, give it any title, fill in the Card ID (copy from the React app's card grid — see below) and Price, then Publish
9. Confirm it's working by visiting your site's REST endpoint directly in a browser:
   ```
   http://yoursite.local/wp-json/wp/v2/gengar_card
   ```
   You should see JSON output including your `card_id` and `price` values

### Part 2: Run the React front end

1. Install Node.js: https://nodejs.org/
2. Clone this repo:
   ```bash
   git clone https://github.com/JMcGarrity/gengar-tcg-site.git
   cd gengar-tcg-site
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Open `src/App.jsx` and update the `WP_API_URL` constant near the top to match your own Local site's URL:
   ```js
   const WP_API_URL = "http://yoursite.local/wp-json/wp/v2/gengar_card?per_page=100";
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Open the local URL shown in the terminal (typically `http://localhost:5173`)

The site header will show whether it's successfully pulling prices from WordPress, or has fallen back to the local file (useful for confirming the connection is actually working).

---

## How to Add Real Prices

1. Run the site and use the **"Browse by Set"** dropdown to look through Gengar's cards
2. Each card tile shows its **unique ID** underneath it (e.g. `swsh8-157`)
3. In wp-admin, go to **Gengar Cards → Add New**
4. Paste that ID into the Card ID field, enter the Price, and Publish
5. Refresh the React app — the new price appears automatically

The **"Top 3 Cards"** section automatically displays whichever 3 Gengar Cards in WordPress have the highest price — no need to manually choose them.

---

## File Overview & Core Logic

### `wordpress-plugin/gengar-card-price-manager.php`

This is a small WordPress plugin doing two things:

1. **Registers the custom post type** (`register_post_type`), with `'show_in_rest' => true` — this single setting is what makes WordPress automatically expose these posts at `/wp-json/wp/v2/gengar_card`, with no extra routing code needed.

2. **Exposes the ACF fields in the REST response** using `register_rest_field()`. By default, WordPress's REST API only includes built-in fields like title and content — custom ACF fields aren't included automatically. This function manually adds `card_id` and `price` into the JSON response for each post, using ACF's `get_field()` function to pull the actual stored value.

### `src/App.jsx`

**Fetching prices from WordPress (with fallback):**
```js
useEffect(() => {
  fetch(WP_API_URL)
    .then((res) => res.json())
    .then((posts) => {
      const priceMap = {};
      posts.forEach((post) => {
        if (post.card_id) priceMap[post.card_id] = post.price;
      });
      setPriceData(priceMap);
      setPriceSource("wordpress");
    })
    .catch((err) => {
      setPriceData(fallbackPriceData);
      setPriceSource("fallback");
    });
}, []);
```
WordPress returns an array of post objects. This converts that array into a simple `{ cardId: price }` lookup object - the same shape as the local fallback file - so the rest of the component doesn't need to know or care which source the prices came from. If the fetch fails for any reason (WordPress not running, wrong URL, network issue), it falls back to `priceData.js` instead of breaking the page.

**Fetching all Gengar cards from the Pokemon TCG API:** unchanged from the original version, runs once on mount, fetches all cards matching "gengar" in the name.

**Deriving the set list, filtering by set, and building Top 3:** unchanged from the original version all still driven by data already in memory, no extra API calls needed when interacting with the UI.

### `src/priceData.js`
Now used only as a **fallback** if WordPress is unreachable, rather than the primary source kept so the app degrades gracefully instead of breaking.

### `src/App.css`
Same purple/red Gengar theme as before, with a small addition: a status note in the header showing which price source is currently active (WordPress vs. fallback), useful for debugging the connection, and a good visual cue during a demo.

---

## Known Limitations
- The WordPress REST endpoint used here is unauthenticated and read-only — fine for a demo/portfolio project, but a production version would likely restrict write access and consider caching, since the Pokemon TCG API and WordPress are both queried on every page load
- ACF's "Show in REST API" setting must be manually enabled per field group — if prices aren't appearing, this is the most common cause
- No persistent local database beyond WordPress itself; the fallback file is static and won't reflect real-time changes
