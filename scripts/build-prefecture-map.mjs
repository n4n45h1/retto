#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { get } from "node:https";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_GML.zip";
const SOURCE_MEMBER = "N03-20250101_prefecture.geojson";
const EXPECTED_ARCHIVE_SHA256 =
  "df20ebf7193e445ef3846b41578068848bb1a79836151cc8c1ec6275cca984a5";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputPath = join(projectRoot, "src/data/maps/prefectures.json");
const cacheDirectory = join(projectRoot, ".cache/prefecture-map");
const archivePath = join(cacheDirectory, "N03-20250101_GML.zip");

const width = 780;
const height = 780;
const simplifyTolerance = 0.55;
const minimumPolygonArea = 0.4;

async function download(url, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await new Promise((resolveDownload, reject) => {
    const request = get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        download(new URL(response.headers.location, url), destination).then(
          resolveDownload,
          reject,
        );
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}`));
        return;
      }
      const output = createWriteStream(destination);
      response.pipe(output);
      output.on("finish", () => output.close(resolveDownload));
      output.on("error", reject);
    });
    request.on("error", reject);
  });
}

async function sha256(path) {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function project([longitude, latitude]) {
  // Okinawa is moved to a conventional inset so its islands remain usable.
  const insetLongitude =
    latitude < 28.5 && longitude < 132 ? longitude + 7 : longitude;
  return [(insetLongitude - 129) * 44, (46 - latitude) * 35];
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplify(points, tolerance) {
  if (points.length <= 4) return points;
  const squaredTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  const stack = [0, points.length - 1];
  markers[0] = 1;
  markers[points.length - 1] = 1;
  while (stack.length) {
    const end = stack.pop();
    const start = stack.pop();
    let furthestIndex = 0;
    let furthestDistance = 0;
    for (let index = start + 1; index < end; index += 1) {
      const distance = squaredSegmentDistance(
        points[index],
        points[start],
        points[end],
      );
      if (distance > furthestDistance) {
        furthestIndex = index;
        furthestDistance = distance;
      }
    }
    if (furthestDistance > squaredTolerance) {
      markers[furthestIndex] = 1;
      stack.push(start, furthestIndex, furthestIndex, end);
    }
  }
  return points.filter((_, index) => markers[index]);
}

function area(ring) {
  let result = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    result +=
      ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return Math.abs(result / 2);
}

function ringPath(coordinates) {
  const projected = coordinates.map(project);
  if (area(projected) < minimumPolygonArea) return null;
  const openRing = projected.slice(0, -1);
  const simplified = simplify(openRing, simplifyTolerance);
  if (simplified.length < 3) return null;
  return `${simplified
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`,
    )
    .join("")}Z`;
}

function geometryPaths(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => {
    const outer = ringPath(polygon[0]);
    if (!outer) return [];
    const holes = polygon.slice(1).map(ringPath).filter(Boolean);
    return [outer, ...holes];
  });
}

async function featureLines() {
  const unzip = spawn("unzip", ["-p", archivePath, SOURCE_MEMBER], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const lines = createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  return { lines, unzip };
}

async function main() {
  try {
    await stat(archivePath);
  } catch {
    console.log(`Downloading ${SOURCE_URL}`);
    await download(SOURCE_URL, archivePath);
  }
  const archiveHash = await sha256(archivePath);
  if (archiveHash !== EXPECTED_ARCHIVE_SHA256) {
    throw new Error(`Archive SHA-256 mismatch: ${archiveHash}`);
  }

  const prefectures = new Map();
  const { lines, unzip } = await featureLines();
  for await (const line of lines) {
    if (!line.startsWith('{ "type": "Feature"')) continue;
    const feature = JSON.parse(line.endsWith(",") ? line.slice(0, -1) : line);
    const code = feature.properties.N03_007?.slice(0, 2);
    if (!/^(0[1-9]|[1-3][0-9]|4[0-7])$/.test(code)) {
      throw new Error(
        `Invalid JIS prefecture code: ${feature.properties.N03_007}`,
      );
    }
    const current = prefectures.get(code) ?? {
      id: `jp-${code}`,
      code,
      name: feature.properties.N03_001,
      paths: [],
    };
    current.paths.push(...geometryPaths(feature.geometry));
    prefectures.set(code, current);
  }
  const exitCode = await new Promise((resolveExit) =>
    unzip.on("close", resolveExit),
  );
  if (exitCode !== 0) throw new Error(`unzip exited with status ${exitCode}`);

  const features = [...prefectures.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(({ paths, ...prefecture }) => ({
      ...prefecture,
      path: paths.join(""),
    }));
  if (
    features.length !== 47 ||
    features.some(({ path }) => path.length === 0)
  ) {
    throw new Error(
      `Expected 47 non-empty prefectures, found ${features.length}`,
    );
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ width, height, features }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${features.length} prefectures to ${outputPath}`);
}

await main();
