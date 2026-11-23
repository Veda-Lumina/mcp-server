# Veda Lumina Model Context Protocol (MCP) Server

Official Model Context Protocol (MCP) Server for **Veda Lumina** (https://www.vedalumina.com).

Connects Vedic astrology (Jyotish) calculations — sidereal (Lahiri) chart, Vimshottari dasha, Panchanga limbs, Jaimini Chara Karakas and Vastu direction reference — to **Claude Desktop**, **Claude Enterprise**, and any MCP-compliant AI client.

Positions come from [astronomy-engine](https://github.com/cosinekitty/astronomy) (VSOP87 / ELP), arc-minute class precision; lunar nodes are mean nodes. Pass `timezone` (IANA, e.g. `Asia/Kolkata`) with birth data — without it the birth time is read as UTC, and every response says how the time was interpreted (`timeBasis`).

---

## 🛠 Available Tools

| Tool Name | Description |
|---|---|
| `calculate_vedic_chart` | Sidereal (Lahiri) planetary positions, Ascendant (Lagna), whole-sign houses, nakshatras and basic dignities. |
| `calculate_dasha_periods` | Vimshottari mahadasha timeline with the active mahadasha and antardasha. |
| `get_daily_panchang` | The 5 Panchanga limbs (Tithi, Vara, Nakshatra, Yoga, Karana) at local noon. Sunrise-based windows (Hora, Choghadiya, Rahu Kaal) are not computed. |
| `calculate_jaimini_karakas` | The 7 Jaimini Chara Karakas (Atmakaraka to Darakaraka). |
| `analyze_vastu_zone` | Element, ruling deity and attributes for the 8 principal Vastu directions. |

> **1.1.0:** `calculate_muhurta_score` and `get_pancha_pakshi_state` were removed — they returned fixed placeholder results. Planet positions previously came from mean-motion formulas (errors of tens of degrees for Mercury, Venus and Mars) and the ascendant was offset by 90°; both are fixed.

---

## 🚀 Quick Setup in Claude Desktop

Add this configuration snippet to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "veda-lumina": {
      "command": "npx",
      "args": ["-y", "@vedalumina/mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add veda-lumina -- npx -y @vedalumina/mcp-server
```

### Other MCP clients

Run `npx -y @vedalumina/mcp-server` as a stdio server. Node.js 18 or newer.

### Try it

> Cast my Vedic chart: born 14 March 1990, 06:45, Jaipur (26.91, 75.79), timezone Asia/Kolkata. Which Vimshottari dasha am I in?

---

## Scope

This server covers the core calculations. The full Veda Lumina app at [vedalumina.com](https://www.vedalumina.com) adds Swiss Ephemeris positions, divisional charts D1–D60, KP sub-lords, Shadbala, Ashtakavarga, Varshaphala, Prashna, Muhurta, and Ask Veda, an AI astrologer that cites classical texts.

---

## 💻 Local Development & Building

```bash
cd mcp-server
npm install
npm run build
npm start
```

---

## License

MIT © Veda Lumina LLC
