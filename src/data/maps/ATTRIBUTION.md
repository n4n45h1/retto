# Prefecture map attribution

Source: [National Land Numerical Information, Administrative Area Data (N03), 2025 edition](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html), Ministry of Land, Infrastructure, Transport and Tourism (MLIT), Japan.

- Dataset identifier: N03
- Dataset reference date: 2025-01-01
- Dataset update: June 2025
- Source archive: `N03-20250101_GML.zip`
- Archive SHA-256: `df20ebf7193e445ef3846b41578068848bb1a79836151cc8c1ec6275cca984a5`
- Retrieved: 2026-08-26
- Original CRS: JGD2011 geographic coordinates (EPSG:6668)

`prefectures.json` was created from the archive's prefecture-level GeoJSON by `scripts/build-prefecture-map.mjs`. The transformation groups polygon fragments by the first two digits of `N03_007` (the JIS X 0401 prefecture code), removes sub-pixel islands, applies Douglas-Peucker line simplification, projects coordinates to an SVG coordinate plane, and moves Okinawa to an inset. It is an edited visualization, not an authoritative survey product.

IDs map directly and exhaustively from JIS X 0401: code `01` is `jp-01`, through code `47` as `jp-47`.

The dataset page labels N03 as open data under [CC BY 4.0-compatible government terms](https://nlftp.mlit.go.jp/ksj/other/agreement_01.html). Attribution is required, modifications must be disclosed, and the result must not be represented as created by the Government of Japan. The N03 page also notes that secondary use may require an application to the Geospatial Information Authority of Japan under the Survey Act; downstream distributors should assess that requirement for their use. The original source materials are GSI Digital Map (Basic Geospatial Information), GSI Tiles, and the Ministry of Internal Affairs and Communications local-government code list. MLIT's source carries GSI reproduction approval `R 6JHf 503`.
